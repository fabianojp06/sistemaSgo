import type { PrismaClient, TabelaSalarial, Senioridade, Cargo } from '@prisma/client';
import { CargoNaoEncontradoError } from '@/domain/plano-contas/errors';

type ListarTabelaSalarialInput = {
  tenantId: string;
  /** Omitido = lista de TODOS os Cargos do tenant (tela própria, US-131 seção 5 melhorada). */
  cargoId?: string;
};

export type RegistroTabelaSalarial = TabelaSalarial & {
  senioridade: Senioridade;
  cargo: Pick<Cargo, 'id' | 'nomeCargoMercado' | 'codigoCargo'>;
};

/**
 * US-131, Cenário 5 / seção 5.2 — consulta de faixas de mercado. Com `cargoId`, retorna
 * TODOS os registros daquele Cargo (RN_TAB_03, sem chave única Cargo+Senioridade) — uso
 * a partir da tela de Cargos. Sem `cargoId`, retorna todos os registros do tenant — uso
 * na tela própria da Tabela Salarial (US-131, melhoria de visualização).
 */
export class ListarTabelaSalarialUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ListarTabelaSalarialInput): Promise<RegistroTabelaSalarial[]> {
    if (input.cargoId) {
      const cargo = await this.prisma.cargo.findFirst({
        where: { tenantId: input.tenantId, id: input.cargoId, ativo: true },
        select: { id: true },
      });
      if (!cargo) {
        throw new CargoNaoEncontradoError();
      }
    }

    return this.prisma.tabelaSalarial.findMany({
      where: { tenantId: input.tenantId, ...(input.cargoId ? { cargoId: input.cargoId } : {}) },
      include: { senioridade: true, cargo: { select: { id: true, nomeCargoMercado: true, codigoCargo: true } } },
      orderBy: [{ senioridade: { descricao: 'asc' } }, { createdAt: 'desc' }],
    });
  }
}
