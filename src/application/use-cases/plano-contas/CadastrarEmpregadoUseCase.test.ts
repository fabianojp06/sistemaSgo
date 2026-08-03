import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CadastrarEmpregadoUseCase } from './CadastrarEmpregadoUseCase';
import {
  CargoObrigatorioEmpregadoError,
  EmpregadoForaDeEscopoCategoriaError,
  PeriodoInicialRetroativoError,
} from '@/domain/plano-contas/errors';

type PropostaMock = { id: string; tenantId: string; categoria: string; status: string; dataInicio: Date };
type CargoMock = {
  id: string;
  tenantId: string;
  propostaId: string;
  codigoCargo: string;
  salarioTotal: Prisma.Decimal;
  unidadeFuncional: { nome: string };
};

function criarPrismaMock(propostas: PropostaMock[], cargos: CargoMock[]) {
  let idSeq = 1;

  const base = {
    proposta: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string } }) =>
        Promise.resolve(propostas.find((p) => p.tenantId === where.tenantId && p.id === where.id) ?? null),
      ),
    },
    cargo: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string; propostaId: string } }) =>
        Promise.resolve(
          cargos.find((c) => c.tenantId === where.tenantId && c.id === where.id && c.propostaId === where.propostaId) ?? null,
        ),
      ),
    },
    empregadoHeadcount: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: `e${idSeq++}`, ativo: true, ...data })),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const propostaConsolidada: PropostaMock = {
  id: 'p1',
  tenantId: 't1',
  categoria: 'CONSOLIDADA',
  status: 'RASCUNHO',
  dataInicio: new Date('2026-01-01'),
};
const propostaPorMeta: PropostaMock = {
  id: 'p2',
  tenantId: 't1',
  categoria: 'POR_META',
  status: 'RASCUNHO',
  dataInicio: new Date('2026-01-01'),
};
const cargo: CargoMock = {
  id: 'c1',
  tenantId: 't1',
  propostaId: 'p1',
  codigoCargo: 'CARGO-2026-0001',
  salarioTotal: new Prisma.Decimal(6200),
  unidadeFuncional: { nome: 'Setor de Compras' },
};

describe('CadastrarEmpregadoUseCase [US-108]', () => {
  it('cadastra Empregado herdando custo e vínculo do Cargo [Cenário 1]', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadoUseCase(prisma as never);

    const empregado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      cargoId: 'c1',
      nome: 'Maria da Silva',
      categoria: 'EMPREGADO',
      periodoInicio: new Date('2026-02-01'),
    });

    expect(empregado.custoTotalMensal.toString()).toBe('6200');
    expect(empregado.vinculoFuncionalHerdado).toBe('Setor de Compras');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'EMPREGADO_CRIADO' }) }),
    );
  });

  it('grava "A CONTRATAR" quando o nome vem vazio [Cenário 2, RN0249]', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadoUseCase(prisma as never);

    const empregado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      cargoId: 'c1',
      nome: '',
      categoria: 'EMPREGADO',
      periodoInicio: new Date('2026-02-01'),
    });

    expect(empregado.nome).toBe('A CONTRATAR');
  });

  it('bloqueia cadastro em Proposta POR_META [Cenário 3]', async () => {
    const prisma = criarPrismaMock([propostaPorMeta], [cargo]);
    const useCase = new CadastrarEmpregadoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p2',
        cargoId: 'c1',
        categoria: 'EMPREGADO',
        periodoInicio: new Date('2026-02-01'),
      }),
    ).rejects.toThrow(EmpregadoForaDeEscopoCategoriaError);
  });

  it('bloqueia cadastro sem Cargo [Cenário 4]', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        cargoId: '',
        categoria: 'EMPREGADO',
        periodoInicio: new Date('2026-02-01'),
      }),
    ).rejects.toThrow(CargoObrigatorioEmpregadoError);
  });

  it('bloqueia Período Inicial anterior à data de início da Proposta [Cenário 5]', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        cargoId: 'c1',
        categoria: 'EMPREGADO',
        periodoInicio: new Date('2025-12-01'),
      }),
    ).rejects.toThrow(PeriodoInicialRetroativoError);
  });
});
