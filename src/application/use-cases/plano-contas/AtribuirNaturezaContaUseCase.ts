import type { ContaContabil, PrismaClient } from '@prisma/client';
import { ContaNaoAnaliticaError, NaturezaHierarquiaInvalidaError } from '@/domain/plano-contas/errors';

type Natureza = 'OPEX' | 'CAPEX';

type AtribuirNaturezaContaInput = {
  tenantId: string;
  usuarioId: string;
  contaId: string;
  natureza: Natureza | null;
};

/** US-003 — Associar Tag de Natureza (OPEX/CAPEX) a Conta Analítica [RF_PLA_REQ_003, RN_PLA_005]. */
export class AtribuirNaturezaContaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: AtribuirNaturezaContaInput): Promise<ContaContabil> {
    const conta = await this.prisma.contaContabil.findFirstOrThrow({
      where: { id: input.contaId, tenantId: input.tenantId },
    });

    // Cenário 4 — seletor só existe para contas analíticas (nó folha).
    if (!conta.isAnalitica) {
      throw new ContaNaoAnaliticaError();
    }

    if (input.natureza !== null) {
      this.validarConsistenciaHierarquica(conta, input.natureza, await this.buscarTodasContas(input.tenantId));
    }

    const naturezaAnterior = conta.natureza;

    const [contaAtualizada] = await this.prisma.$transaction([
      this.prisma.contaContabil.update({
        where: { id: conta.id },
        data: { natureza: input.natureza },
      }),
      this.prisma.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'NATUREZA_ALTERADA',
          descricao: `Natureza da conta "${conta.codigoErp} — ${conta.nomeConta}" alterada de ${naturezaAnterior ?? 'Sem classificação'} para ${input.natureza ?? 'Sem classificação'}`,
          dadosSerializados: {
            contaId: conta.id,
            codigoErp: conta.codigoErp,
            naturezaAnterior,
            naturezaNova: input.natureza,
          },
        },
      }),
    ]);

    return contaAtualizada;
  }

  private async buscarTodasContas(tenantId: string) {
    return this.prisma.contaContabil.findMany({
      where: { tenantId },
      select: { id: true, idPai: true, natureza: true },
    });
  }

  // RN_PLA_005 — sobe a cadeia de idPai até a raiz; qualquer ancestral com natureza
  // preenchida e diferente da tentativa bloqueia a atribuição (regra simétrica:
  // vale tanto para ancestral CAPEX bloqueando filho OPEX quanto o inverso).
  private validarConsistenciaHierarquica(
    conta: ContaContabil,
    naturezaTentativa: Natureza,
    todasContas: { id: string; idPai: string | null; natureza: Natureza | null }[],
  ): void {
    const porId = new Map(todasContas.map((c) => [c.id, c]));

    let idAtual = conta.idPai;
    while (idAtual) {
      const ancestral = porId.get(idAtual);
      if (!ancestral) break;

      if (ancestral.natureza && ancestral.natureza !== naturezaTentativa) {
        throw new NaturezaHierarquiaInvalidaError(ancestral.natureza, naturezaTentativa);
      }

      idAtual = ancestral.idPai;
    }
  }
}
