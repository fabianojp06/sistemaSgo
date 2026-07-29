import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { ContaContabilPayload } from '@/infrastructure/integrations/senior/types';
import { ContasOrfasError } from '@/domain/plano-contas/errors';

export type ResultadoSincronismo = {
  contasProcessadas: number;
};

/**
 * Único ponto de escrita em ContaContabil [RN_PLA_001, RN_PLA_002]. Volume atual é
 * dezenas de linhas — upsert em lote (`$transaction` na forma array) é suficiente.
 * Se o volume real do ERP Senior chegar à casa dos milhares (RNF_PLA_REQ_001),
 * trocar por $executeRaw em lote único.
 *
 * Usa a forma array do `$transaction` (não a interativa `async (tx) => {...}`)
 * porque o pooler do Supabase pode não manter a mesma conexão/sessão entre
 * round-trips sequenciais do código da aplicação, invalidando uma transação
 * interativa no meio do processo ("Transaction not found"). A forma array é
 * montada e enviada de uma vez ao engine do Prisma, sem esse risco — por isso o
 * `idPai` de cada conta é resolvido ANTES de montar o lote, não a partir do
 * retorno sequencial de cada upsert.
 */
export class PlanoContasBulkLoader {
  constructor(private readonly prisma: PrismaClient) {}

  async sincronizar(tenantId: string, payload: ContaContabilPayload[]): Promise<ResultadoSincronismo> {
    this.validarIntegridadeReferencial(payload);

    const ordenado = [...payload].sort((a, b) => a.nivel - b.nivel);
    const agora = new Date();

    const existentes = await this.prisma.contaContabil.findMany({
      where: { tenantId, codigoErp: { in: ordenado.map((c) => c.codigoErp) } },
      select: { id: true, codigoErp: true },
    });
    const idPorCodigo = new Map(existentes.map((c) => [c.codigoErp, c.id]));

    for (const conta of ordenado) {
      if (!idPorCodigo.has(conta.codigoErp)) {
        idPorCodigo.set(conta.codigoErp, randomUUID());
      }
    }

    const operacoes = ordenado.map((conta) => {
      const id = idPorCodigo.get(conta.codigoErp)!;
      const idPai = conta.codigoPaiErp ? idPorCodigo.get(conta.codigoPaiErp) ?? null : null;

      return this.prisma.contaContabil.upsert({
        where: { tenantId_codigoErp: { tenantId, codigoErp: conta.codigoErp } },
        create: {
          id,
          tenantId,
          codigoErp: conta.codigoErp,
          nomeConta: conta.nomeConta,
          nivel: conta.nivel,
          idPai,
          isAnalitica: conta.isAnalitica,
          statusSync: 'SINCRONIZADO',
          syncedAt: agora,
          erpUpdatedAt: agora,
        },
        update: {
          // nome/hierarquia refletem a fonte externa a cada sync; `natureza`
          // (parametrização local, RF_PLA_REQ_003) nunca é tocada aqui.
          nomeConta: conta.nomeConta,
          nivel: conta.nivel,
          idPai,
          isAnalitica: conta.isAnalitica,
          statusSync: 'SINCRONIZADO',
          syncedAt: agora,
          erpUpdatedAt: agora,
        },
      });
    });

    await this.prisma.$transaction(operacoes as Prisma.PrismaPromise<unknown>[]);

    return { contasProcessadas: ordenado.length };
  }

  private validarIntegridadeReferencial(payload: ContaContabilPayload[]): void {
    const codigos = new Set(payload.map((c) => c.codigoErp));
    const orfaos = payload
      .filter((c) => c.codigoPaiErp !== null && !codigos.has(c.codigoPaiErp))
      .map((c) => c.codigoErp);

    if (orfaos.length > 0) {
      throw new ContasOrfasError(orfaos);
    }
  }
}
