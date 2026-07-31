import type { PrismaClient } from '@prisma/client';
import { VersaoOficializadaCongeladaError, VersaoPropostaInvalidaError } from '@/domain/plano-contas/errors';

type DesativarTributoRateioInput = {
  tenantId: string;
  usuarioId: string;
  versaoId: string;
  aliquotaParametroId: string;
};

/**
 * US-101, Cenário 3 — desmarcar um tributo remove seus valores do cálculo do
 * Valor Global sem apagar o histórico (soft delete via `ativo=false`, ADR-014).
 */
export class DesativarTributoRateioUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: DesativarTributoRateioInput): Promise<{ linhasDesativadas: number }> {
    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: input.versaoId, ativa: true },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }
    if (versao.status !== 'RASCUNHO' && versao.status !== 'EM_ELABORACAO') {
      throw new VersaoOficializadaCongeladaError();
    }

    const aliquotaParametro = await this.prisma.aliquotaImpostoParametro.findFirst({
      where: { tenantId: input.tenantId, id: input.aliquotaParametroId },
    });

    return this.prisma.$transaction(async (tx) => {
      const resultado = await tx.rateioImpostoGrade.updateMany({
        where: { tenantId: input.tenantId, versaoId: input.versaoId, aliquotaParametroId: input.aliquotaParametroId },
        data: { ativo: false },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'RATEIO_IMPOSTO_DESATIVADO',
          descricao: `Tributo "${aliquotaParametro?.nome ?? input.aliquotaParametroId}" desmarcado da Versão`,
          dadosSerializados: {
            versaoId: input.versaoId,
            aliquotaParametroId: input.aliquotaParametroId,
            linhasDesativadas: resultado.count,
          },
        },
      });

      return { linhasDesativadas: resultado.count };
    });
  }
}
