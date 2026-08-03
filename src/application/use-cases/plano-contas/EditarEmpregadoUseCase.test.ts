import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EditarEmpregadoUseCase } from './EditarEmpregadoUseCase';

type PropostaMock = { id: string; tenantId: string; status: string; dataInicio: Date };
type CargoMock = {
  id: string;
  tenantId: string;
  propostaId: string;
  codigoCargo: string;
  salarioTotal: Prisma.Decimal;
  unidadeFuncional: { nome: string };
};
type EmpregadoMock = {
  id: string;
  tenantId: string;
  propostaId: string;
  cargoId: string;
  nome: string;
  vinculoFuncionalHerdado: string;
  custoTotalMensal: Prisma.Decimal;
  ativo: boolean;
};

function criarPrismaMock(empregado: EmpregadoMock, proposta: PropostaMock, cargos: CargoMock[]) {
  let atual = { ...empregado };

  const base = {
    empregadoHeadcount: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string } }) =>
        Promise.resolve(atual.tenantId === where.tenantId && atual.id === where.id ? atual : null),
      ),
      update: vi.fn(({ data }: { data: Partial<EmpregadoMock> }) => {
        atual = { ...atual, ...data };
        return Promise.resolve(atual);
      }),
    },
    proposta: {
      findFirst: vi.fn(() => Promise.resolve(proposta)),
    },
    cargo: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string; propostaId: string } }) =>
        Promise.resolve(
          cargos.find((c) => c.tenantId === where.tenantId && c.id === where.id && c.propostaId === where.propostaId) ?? null,
        ),
      ),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const proposta: PropostaMock = { id: 'p1', tenantId: 't1', status: 'RASCUNHO', dataInicio: new Date('2026-01-01') };
const cargoOriginal: CargoMock = {
  id: 'c1',
  tenantId: 't1',
  propostaId: 'p1',
  codigoCargo: 'CARGO-2026-0001',
  salarioTotal: new Prisma.Decimal(6200),
  unidadeFuncional: { nome: 'Setor de Compras' },
};
const cargoNovo: CargoMock = {
  id: 'c2',
  tenantId: 't1',
  propostaId: 'p1',
  codigoCargo: 'CARGO-2026-0003',
  salarioTotal: new Prisma.Decimal(7100),
  unidadeFuncional: { nome: 'Coordenadoria Financeira' },
};

const empregadoBase: EmpregadoMock = {
  id: 'e1',
  tenantId: 't1',
  propostaId: 'p1',
  cargoId: 'c1',
  nome: 'Maria da Silva',
  vinculoFuncionalHerdado: 'Setor de Compras',
  custoTotalMensal: new Prisma.Decimal(6200),
  ativo: true,
};

describe('EditarEmpregadoUseCase [US-108]', () => {
  it('recalcula o custo herdado ao trocar de Cargo [Cenário 6]', async () => {
    const prisma = criarPrismaMock(empregadoBase, proposta, [cargoOriginal, cargoNovo]);
    const useCase = new EditarEmpregadoUseCase(prisma as never);

    const empregado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      empregadoId: 'e1',
      cargoId: 'c2',
      nome: 'Maria da Silva',
      categoria: 'EMPREGADO',
      periodoInicio: new Date('2026-02-01'),
    });

    expect(empregado.custoTotalMensal.toString()).toBe('7100');
    expect(empregado.vinculoFuncionalHerdado).toBe('Coordenadoria Financeira');
  });

  it('ignora tentativa de editar o Custo Total Mensal manualmente e preserva o snapshot [Cenário 7]', async () => {
    const prisma = criarPrismaMock(empregadoBase, proposta, [cargoOriginal, cargoNovo]);
    const useCase = new EditarEmpregadoUseCase(prisma as never);

    const empregado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      empregadoId: 'e1',
      cargoId: 'c1', // mesmo cargo — não deve recarregar
      nome: 'Maria da Silva Souza',
      categoria: 'EMPREGADO',
      periodoInicio: new Date('2026-02-01'),
      custoTotalMensal: 99999, // tentativa de injeção — deve ser ignorada
    });

    expect(empregado.custoTotalMensal.toString()).toBe('6200');
    expect(empregado.nome).toBe('Maria da Silva Souza');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'EMPREGADO_EDITADO' }) }),
    );
  });
});
