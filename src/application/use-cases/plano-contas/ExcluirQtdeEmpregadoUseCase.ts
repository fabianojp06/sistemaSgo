import type { PrismaClient } from '@prisma/client';
import { QtdeEmpregadoNaoEncontradaError, QtdeEmpregadoPropostaImutavelError } from '@/domain/plano-contas/errors';

type ExcluirQtdeEmpregadoInput = {
  tenantId: string;
  usuarioId: string;
  qtdeEmpregadoId: string;
};

/**
 * US-113, Cenário 7 — Excluir Qtde. Empregado (soft delete). Sem checagem de
 * despesas vinculadas (RN0145/E2 da Minuta) — mesmo gap já aceito em
 * ExcluirViagemUseCase/ExcluirMetaUseCase, pois não existe módulo de
 * Diária/Adiantamento nem FK entre essas despesas e headcounts individuais.
 */
export class ExcluirQtdeEmpregadoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ExcluirQtdeEmpregadoInput): Promise<void> {
    const qtdeEmpregado = await this.prisma.qtdeEmpregado.findFirst({
      where: { tenantId: input.tenantId, id: input.qtdeEmpregadoId, ativo: true },
    });
    if (!qtdeEmpregado) {
      throw new QtdeEmpregadoNaoEncontradaError();
    }

    const proposta = await this.prisma.proposta.findFirst({ where: { tenantId: input.tenantId, id: qtdeEmpregado.propostaId } });
    if (!proposta || (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO')) {
      throw new QtdeEmpregadoPropostaImutavelError();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.qtdeEmpregado.update({ where: { id: input.qtdeEmpregadoId }, data: { ativo: false } });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'QTDE_EMPREGADO_EXCLUIDA',
          descricao: `Qtde. Empregado "${qtdeEmpregado.numeroDocumento}" excluída`,
          dadosSerializados: { qtdeEmpregadoId: qtdeEmpregado.id, propostaId: qtdeEmpregado.propostaId },
        },
      });
    });
  }
}
