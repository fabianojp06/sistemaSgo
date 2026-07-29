import type { Prisma, PrismaClient } from '@prisma/client';
import type { ContaContabilPayload } from '@/infrastructure/integrations/senior/types';
import { ContasOrfasError } from '@/domain/plano-contas/errors';

export type ResultadoSincronismo = {
  contasProcessadas: number;
};

/**
 * Único ponto de escrita em ContaContabil [RN_PLA_001, RN_PLA_002]. Volume atual é
 * fictício (dezenas de linhas) — upsert por linha dentro de uma única transação é
 * suficiente. Se o volume real do ERP Senior chegar à casa dos milhares
 * (RNF_PLA_REQ_001), trocar por $executeRaw em lote único.
 */
export class PlanoContasBulkLoader {
  constructor(private readonly prisma: PrismaClient) {}

  async sincronizar(tenantId: string, payload: ContaContabilPayload[]): Promise<ResultadoSincronismo> {
    this.validarIntegridadeReferencial(payload);

    const ordenado = [...payload].sort((a, b) => a.nivel - b.nivel);
    const agora = new Date();

    await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const idPorCodigo = new Map<string, string>();

        for (const conta of ordenado) {
          const idPai = conta.codigoPaiErp ? idPorCodigo.get(conta.codigoPaiErp) ?? null : null;

          const salvo = await tx.contaContabil.upsert({
            where: { tenantId_codigoErp: { tenantId, codigoErp: conta.codigoErp } },
            create: {
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

          idPorCodigo.set(conta.codigoErp, salvo.id);
        }
      },
      // Default do Prisma (5s de timeout, 2s de maxWait) não é suficiente para
      // dezenas de upserts sequenciais sobre o pooler do Supabase — cada round-trip
      // soma latência de rede e a transação interativa expira antes de terminar.
      { timeout: 30_000, maxWait: 10_000 },
    );

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
