import type { PrismaClient, TabelaSalarial, Senioridade } from '@prisma/client';
import { CargoNaoEncontradoError } from '@/domain/plano-contas/errors';

type ListarTabelaSalarialInput = {
  tenantId: string;
  cargoId: string;
};

export type RegistroTabelaSalarial = TabelaSalarial & { senioridade: Senioridade };

/**
 * US-131, Cenário 5 / seção 5.2 — consulta acionada a partir da tela de Cargos: retorna
 * TODOS os registros do Cargo em contexto (RN_TAB_03, sem chave única Cargo+Senioridade),
 * agrupados por Senioridade na ordenação (o agrupamento visual fica a cargo da UI).
 */
export class ListarTabelaSalarialUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ListarTabelaSalarialInput): Promise<RegistroTabelaSalarial[]> {
    const cargo = await this.prisma.cargo.findFirst({
      where: { tenantId: input.tenantId, id: input.cargoId, ativo: true },
      select: { id: true },
    });
    if (!cargo) {
      throw new CargoNaoEncontradoError();
    }

    return this.prisma.tabelaSalarial.findMany({
      where: { tenantId: input.tenantId, cargoId: input.cargoId },
      include: { senioridade: true },
      orderBy: [{ senioridade: { descricao: 'asc' } }, { createdAt: 'desc' }],
    });
  }
}
