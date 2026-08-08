import type { PrismaClient } from '@prisma/client';
import { EmpregadoNaoEncontradoError, VersaoPropostaInvalidaError } from '@/domain/plano-contas/errors';

type ExcluirEmpregadoInput = {
  tenantId: string;
  usuarioId: string;
  empregadoId: string;
};

/**
 * US-108, Cenário 8/9/10 — Excluir Empregado (soft delete). Verificação de
 * vínculo operacional (diárias/viagens/adiantamentos) sempre retorna "sem
 * vínculo" nesta US — Viagens/Bens ainda não existem.
 */
export class ExcluirEmpregadoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ExcluirEmpregadoInput): Promise<void> {
    const empregado = await this.prisma.empregadoHeadcount.findFirst({
      where: { tenantId: input.tenantId, id: input.empregadoId, ativo: true },
    });
    if (!empregado) {
      throw new EmpregadoNaoEncontradoError();
    }

    const proposta = await this.prisma.proposta.findFirst({
      where: { tenantId: input.tenantId, id: empregado.propostaId },
    });
    if (!proposta || (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO')) {
      throw new VersaoPropostaInvalidaError(
        'Ação Negada: esta Proposta está oficializada e seus dados estão congelados.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.empregadoHeadcount.update({ where: { id: input.empregadoId }, data: { ativo: false } });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'EMPREGADO_EXCLUIDO',
          descricao: `Empregado "${empregado.nome}" excluído`,
          dadosSerializados: {
            empregadoId: empregado.id,
            propostaId: empregado.propostaId,
            custoTotalMensal: empregado.custoTotalMensal.toString(),
          },
        },
      });
    });
  }
}
