import { Prisma, type PrismaClient } from '@prisma/client';
import { SalarioMinimoMaiorIgualMaximoError, TabelaSalarialNaoEncontradaError } from '@/domain/plano-contas/errors';

type EditarTabelaSalarialInput = {
  tenantId: string;
  usuarioId: string;
  tabelaSalarialId: string;
  salarioMinimo: Prisma.Decimal.Value;
  salarioMaximo: Prisma.Decimal.Value;
};

/**
 * US-131 (REQ_TAB_001) — edita Mín/Máx de um registro já cadastrado. Cargo e Senioridade
 * não são editáveis aqui — trocar o par é excluir e recadastrar (mesmo padrão implícito da
 * Minuta, que não descreve troca de Cargo/Senioridade em um registro existente).
 */
export class EditarTabelaSalarialUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: EditarTabelaSalarialInput) {
    const salarioMinimo = new Prisma.Decimal(input.salarioMinimo);
    const salarioMaximo = new Prisma.Decimal(input.salarioMaximo);
    if (salarioMinimo.greaterThanOrEqualTo(salarioMaximo)) {
      throw new SalarioMinimoMaiorIgualMaximoError();
    }

    const atual = await this.prisma.tabelaSalarial.findFirst({
      where: { tenantId: input.tenantId, id: input.tabelaSalarialId },
    });
    if (!atual) {
      throw new TabelaSalarialNaoEncontradaError();
    }

    return this.prisma.$transaction(async (tx) => {
      const editado = await tx.tabelaSalarial.update({
        where: { id: atual.id },
        data: { salarioMinimo, salarioMaximo },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'TABELA_SALARIAL_EDITADA',
          descricao: 'Faixa salarial editada',
          dadosSerializados: {
            tabelaSalarialId: atual.id,
            estadoAnterior: { salarioMinimo: atual.salarioMinimo.toString(), salarioMaximo: atual.salarioMaximo.toString() },
            estadoNovo: { salarioMinimo: salarioMinimo.toString(), salarioMaximo: salarioMaximo.toString() },
          },
        },
      });

      return editado;
    });
  }
}
