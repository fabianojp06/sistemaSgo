import { Prisma, type PrismaClient, type TipoIncidenciaImposto } from '@prisma/client';
import {
  AliquotaImpostoNomeDuplicadoError,
  AliquotaImpostoForaDaFaixaError,
  AliquotaImpostoIssForaDaFaixaLegalError,
  AliquotaImpostoDataInicioRetroativaError,
  AliquotaImpostoDataFimInvalidaError,
  ContaSugeridaAliquotaImpostoNaoSinteticaError,
} from '@/domain/plano-contas/errors';

type CadastrarAliquotaImpostoInput = {
  tenantId: string;
  usuarioId: string;
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

function validarFaixaEDataOuLanca(
  nome: string,
  aliquotaPct: Prisma.Decimal,
  dataInicioVigencia: Date,
  dataFimVigencia: Date | null | undefined,
) {
  if (aliquotaPct.isNaN() || aliquotaPct.lessThan(0) || aliquotaPct.greaterThan(100)) {
    throw new AliquotaImpostoForaDaFaixaError();
  }

  // RN_IMP_006/RN_TAX_01 — case-insensitive.
  if (nome.trim().toLowerCase() === 'iss' && (aliquotaPct.lessThan(2) || aliquotaPct.greaterThan(5))) {
    throw new AliquotaImpostoIssForaDaFaixaLegalError();
  }

  // Datas de vigência vêm de <input type="date"> como "YYYY-MM-DD", parseadas pelo Date
  // constructor como meia-noite UTC (z.coerce.date()). Comparar via setHours(0,0,0,0) usaria
  // meia-noite LOCAL do servidor e, em fusos negativos (ex: UTC-3), voltaria a data em 1 dia —
  // bug real encontrado em QA. Comparação precisa ser 100% em UTC, sem tocar em hora local.
  const inicioDoDiaUTC = (data: Date) => Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
  if (inicioDoDiaUTC(dataInicioVigencia) < inicioDoDiaUTC(new Date())) {
    throw new AliquotaImpostoDataInicioRetroativaError();
  }

  if (dataFimVigencia && dataFimVigencia <= dataInicioVigencia) {
    throw new AliquotaImpostoDataFimInvalidaError();
  }
}

/**
 * UC03.40 — Cadastrar Alíquota de Imposto. Formaliza o cadastro completo de
 * `AliquotaImpostoParametro` (antes só populável via seed) com histórico de vigência e
 * limites legais [TRAVA O ERRO]. `contaSinteticaId` é opcional — sugestão de UX (ADR-038),
 * nunca obrigatória.
 */
export class CadastrarAliquotaImpostoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CadastrarAliquotaImpostoInput) {
    const aliquotaPct = new Prisma.Decimal(input.aliquotaPct);
    validarFaixaEDataOuLanca(input.nome, aliquotaPct, input.dataInicioVigencia, input.dataFimVigencia);

    const nomeNormalizado = input.nome.trim().toLowerCase();
    const duplicado = await this.prisma.aliquotaImpostoParametro.findUnique({
      where: { tenantId_nomeNormalizado: { tenantId: input.tenantId, nomeNormalizado } },
    });
    if (duplicado) {
      throw new AliquotaImpostoNomeDuplicadoError(input.nome);
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
      const criada = await tx.aliquotaImpostoParametro.create({
        data: {
          tenantId: input.tenantId,
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
          ativo: true,
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'ALIQUOTA_IMPOSTO_CRIADA',
          descricao: `Alíquota de imposto "${criada.nome}" cadastrada (${aliquotaPct.toString()}%)`,
          dadosSerializados: {
            aliquotaImpostoParametroId: criada.id,
            nome: criada.nome,
            aliquotaPct: aliquotaPct.toString(),
            tipoIncidencia: criada.tipoIncidencia,
          },
        },
      });

      return criada;
    });
  }
}
