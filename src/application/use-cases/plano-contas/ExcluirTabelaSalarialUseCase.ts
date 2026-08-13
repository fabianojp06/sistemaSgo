import type { PrismaClient } from '@prisma/client';
import { TabelaSalarialNaoEncontradaError } from '@/domain/plano-contas/errors';

type ExcluirTabelaSalarialInput = {
  tenantId: string;
  usuarioId: string;
  tabelaSalarialId: string;
};

/**
 * US-131 (REQ_TAB_001) — exclusão física do registro de pesquisa de mercado. Diferente do
 * padrão [SOFT DELETE] do resto do projeto: TabelaSalarial é dado de pesquisa externa, sem
 * vínculo financeiro/snapshot que dependa de sua permanência (Cargo já copiou Mín/Máx no
 * momento da seleção — US-133 — e não mantém FK viva para o registro de origem).
 */
export class ExcluirTabelaSalarialUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ExcluirTabelaSalarialInput) {
    const atual = await this.prisma.tabelaSalarial.findFirst({
      where: { tenantId: input.tenantId, id: input.tabelaSalarialId },
    });
    if (!atual) {
      throw new TabelaSalarialNaoEncontradaError();
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.tabelaSalarial.delete({ where: { id: atual.id } });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'TABELA_SALARIAL_EXCLUIDA',
          descricao: 'Faixa salarial excluída',
          dadosSerializados: {
            tabelaSalarialId: atual.id,
            cargoId: atual.cargoId,
            senioridadeId: atual.senioridadeId,
            salarioMinimo: atual.salarioMinimo.toString(),
            salarioMaximo: atual.salarioMaximo.toString(),
          },
        },
      });

      return { id: atual.id };
    });
  }
}
