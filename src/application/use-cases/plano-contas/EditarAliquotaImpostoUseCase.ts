import { Prisma, type PrismaClient, type TipoIncidenciaImposto } from '@prisma/client';
import {
  AliquotaImpostoNomeDuplicadoError,
  AliquotaImpostoForaDaFaixaError,
  AliquotaImpostoIssForaDaFaixaLegalError,
  AliquotaImpostoDataInicioRetroativaError,
  AliquotaImpostoDataFimInvalidaError,
  AliquotaImpostoParametroNaoEncontradaError,
  ContaSugeridaAliquotaImpostoNaoSinteticaError,
  ConflitoConcorrenciaError,
} from '@/domain/plano-contas/errors';
import { ehDataAnteriorAHoje } from '@/domain/shared/dataCalendario';

type EditarAliquotaImpostoInput = {
  tenantId: string;
  usuarioId: string;
  aliquotaImpostoParametroId: string;
  version: number;
  nome: string;
  aliquotaPct: Prisma.Decimal.Value;
  tipoIncidencia: TipoIncidenciaImposto;
  dataInicioVigencia: Date;
  dataFimVigencia?: Date | null;
  limiteMinimoPct?: Prisma.Decimal.Value | null;
  limiteMaximoPct?: Prisma.Decimal.Value | null;
  observacao?: string | null;
  contaSinteticaId?: string | null;
};

/**
 * UC03.41 — Alterar Alíquota de Imposto. RN_TAX_03/RN_TAX_06: nunca recalcula Propostas
 * já Oficializadas — o snapshot `RateioImpostoGrade.aliquotaAplicadaSnapshot` é imutável e
 * não é tocado aqui. RNF_TAX_006: Optimistic Locking via `version` (mesmo padrão de US-105).
 */
export class EditarAliquotaImpostoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: EditarAliquotaImpostoInput) {
    const aliquotaPct = new Prisma.Decimal(input.aliquotaPct);

    if (aliquotaPct.isNaN() || aliquotaPct.lessThan(0) || aliquotaPct.greaterThan(100)) {
      throw new AliquotaImpostoForaDaFaixaError();
    }
    if (input.nome.trim().toLowerCase() === 'iss' && (aliquotaPct.lessThan(2) || aliquotaPct.greaterThan(5))) {
      throw new AliquotaImpostoIssForaDaFaixaLegalError();
    }
    // Comparação por calendário puro (ver domain/shared/dataCalendario) — nunca por instante/fuso.
    if (ehDataAnteriorAHoje(input.dataInicioVigencia)) {
      throw new AliquotaImpostoDataInicioRetroativaError();
    }
    if (input.dataFimVigencia && input.dataFimVigencia <= input.dataInicioVigencia) {
      throw new AliquotaImpostoDataFimInvalidaError();
    }

    const atual = await this.prisma.aliquotaImpostoParametro.findFirst({
      where: { tenantId: input.tenantId, id: input.aliquotaImpostoParametroId },
    });
    if (!atual) {
      throw new AliquotaImpostoParametroNaoEncontradaError();
    }

    const nomeNormalizado = input.nome.trim().toLowerCase();
    if (nomeNormalizado !== atual.nomeNormalizado) {
      const duplicado = await this.prisma.aliquotaImpostoParametro.findUnique({
        where: { tenantId_nomeNormalizado: { tenantId: input.tenantId, nomeNormalizado } },
      });
      if (duplicado) {
        throw new AliquotaImpostoNomeDuplicadoError(input.nome);
      }
    }

    if (input.contaSinteticaId) {
      const conta = await this.prisma.contaContabil.findFirst({
        where: { tenantId: input.tenantId, id: input.contaSinteticaId },
        select: { isAnalitica: true },
      });
      if (!conta || conta.isAnalitica) {
        throw new ContaSugeridaAliquotaImpostoNaoSinteticaError();
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const resultado = await tx.aliquotaImpostoParametro.updateMany({
        where: { id: atual.id, version: input.version },
        data: {
          nome: input.nome.trim(),
          nomeNormalizado,
          aliquotaPct,
          tipoIncidencia: input.tipoIncidencia,
          dataInicioVigencia: input.dataInicioVigencia,
          dataFimVigencia: input.dataFimVigencia ?? null,
          limiteMinimoPct: input.limiteMinimoPct != null ? new Prisma.Decimal(input.limiteMinimoPct) : null,
          limiteMaximoPct: input.limiteMaximoPct != null ? new Prisma.Decimal(input.limiteMaximoPct) : null,
          observacao: input.observacao ?? null,
          contaSinteticaId: input.contaSinteticaId ?? null,
          version: { increment: 1 },
        },
      });
      if (resultado.count === 0) {
        throw new ConflitoConcorrenciaError();
      }

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'ALIQUOTA_IMPOSTO_EDITADA',
          descricao: `Alíquota de imposto "${input.nome.trim()}" editada`,
          dadosSerializados: {
            aliquotaImpostoParametroId: atual.id,
            estadoAnterior: {
              nome: atual.nome,
              aliquotaPct: atual.aliquotaPct.toString(),
              tipoIncidencia: atual.tipoIncidencia,
            },
            estadoNovo: {
              nome: input.nome.trim(),
              aliquotaPct: aliquotaPct.toString(),
              tipoIncidencia: input.tipoIncidencia,
            },
          },
        },
      });

      return tx.aliquotaImpostoParametro.findUniqueOrThrow({ where: { id: atual.id } });
    });
  }
}
