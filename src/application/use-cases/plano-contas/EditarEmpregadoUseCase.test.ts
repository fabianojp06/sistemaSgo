import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EditarEmpregadoUseCase } from './EditarEmpregadoUseCase';
import { ConflitoConcorrenciaError } from '@/domain/plano-contas/errors';

type PropostaMock = { id: string; tenantId: string; status: string; dataInicio: Date };
type CargoMock = {
  id: string;
  tenantId: string;
  propostaId: string;
  codigoCargo: string;
  custoTotalCargo: Prisma.Decimal;
  unidadeFuncional: { nome: string } | null;
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
  updatedAt: Date;
};

function criarPrismaMock(empregado: EmpregadoMock, proposta: PropostaMock, cargos: CargoMock[]) {
  let atual = { ...empregado };

  const base = {
    empregadoHeadcount: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string } }) =>
        Promise.resolve(atual.tenantId === where.tenantId && atual.id === where.id ? atual : null),
      ),
      findUniqueOrThrow: vi.fn(() => Promise.resolve(atual)),
      updateMany: vi.fn(({ where, data }: { where: { id: string; updatedAt: Date }; data: Partial<EmpregadoMock> }) => {
        if (atual.id !== where.id || atual.updatedAt.getTime() !== where.updatedAt.getTime()) {
          return Promise.resolve({ count: 0 });
        }
        atual = { ...atual, ...data, updatedAt: new Date(atual.updatedAt.getTime() + 1) };
        return Promise.resolve({ count: 1 });
      }),
    },
    proposta: {
      findFirst: vi.fn(() => Promise.resolve(proposta)),
    },
    cargo: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string; propostaId: string } }) =>
        Promise.resolve(
          (() => {
            const c = cargos.find((c) => c.tenantId === where.tenantId && c.id === where.id && c.propostaId === where.propostaId);
            return c
              ? {
                  salarioTotal: c.custoTotalCargo,
                  status: 'COMPLETO', // ADR-042 — mocks representam Cargo já completo, salvo override em `c`
                  contaId: 'conta-mock',
                  contaGratificacaoId: null,
                  contaEncargosSociaisId: null,
                  contaValeAlimentacaoId: null,
                  contaValeRefeicaoId: null,
                  contaValeTransporteId: null,
                  contaPlanoOdontologicoId: null,
                  contaSeguroVidaId: null,
                  contaPlanoSaudeId: null,
                  contaAuxilioCrecheId: null,
                  encargosSociaisPct: 0,
                  vaAtivo: false,
                  vaValorUnitario: 0,
                  vrAtivo: false,
                  vrValorUnitario: 0,
                  planoSaudeAtivo: false,
                  planoSaudeFaixa: null,
                  planoSaudeValor: 0,
                  planoOdontoAtivo: false,
                  planoOdontoValor: 0,
                  seguroVidaAtivo: false,
                  seguroVidaValor: 0,
                  auxilioCrecheAtivo: false,
                  auxilioCrecheValor: 0,
                  transporteAtivo: false,
                  transporteValorUnitario: 0,
                  ...c,
                }
              : null;
          })(),
        ),
      ),
    },
    parametroSistema: {
      findUnique: vi.fn().mockResolvedValue(null),
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
  custoTotalCargo: new Prisma.Decimal(6200),
  unidadeFuncional: { nome: 'Setor de Compras' },
};
const cargoNovo: CargoMock = {
  id: 'c2',
  tenantId: 't1',
  propostaId: 'p1',
  codigoCargo: 'CARGO-2026-0003',
  custoTotalCargo: new Prisma.Decimal(7100),
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
  updatedAt: new Date('2026-01-01T00:00:00Z'),
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

  it('bloqueia conflito de concorrência quando o token informado diverge do estado atual [US-105]', async () => {
    const prisma = criarPrismaMock(empregadoBase, proposta, [cargoOriginal, cargoNovo]);
    const useCase = new EditarEmpregadoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        empregadoId: 'e1',
        cargoId: 'c1',
        nome: 'Maria da Silva Souza',
        categoria: 'EMPREGADO',
        periodoInicio: new Date('2026-02-01'),
        tokenConcorrencia: new Date('2020-01-01T00:00:00Z'),
      }),
    ).rejects.toThrow(ConflitoConcorrenciaError);
    expect(prisma.empregadoHeadcount.updateMany).not.toHaveBeenCalled();
  });

  it('bloqueia conflito detectado só no updateMany (corrida real entre leitura e escrita) [US-105]', async () => {
    const prisma = criarPrismaMock(empregadoBase, proposta, [cargoOriginal, cargoNovo]);
    prisma.empregadoHeadcount.updateMany.mockResolvedValueOnce({ count: 0 });
    const useCase = new EditarEmpregadoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        empregadoId: 'e1',
        cargoId: 'c1',
        nome: 'Maria da Silva Souza',
        categoria: 'EMPREGADO',
        periodoInicio: new Date('2026-02-01'),
      }),
    ).rejects.toThrow(ConflitoConcorrenciaError);
  });
});
