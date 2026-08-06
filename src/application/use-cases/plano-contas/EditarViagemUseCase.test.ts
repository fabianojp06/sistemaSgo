import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EditarViagemUseCase } from './EditarViagemUseCase';
import { ConflitoConcorrenciaError, ContaViagemNaoAnaliticaError } from '@/domain/plano-contas/errors';

type ViagemMock = {
  id: string;
  tenantId: string;
  versaoId: string;
  metaId: string;
  descricao: string;
  quantidadePessoas: number;
  mediaDias: number;
  custoUnitarioPassagem: Prisma.Decimal;
  contaPassagemId: string;
  custoUnitarioDiaria: Prisma.Decimal;
  contaDiariaId: string;
  custoUnitarioTransporte: Prisma.Decimal;
  contaTransporteId: string;
  custoEstimado: Prisma.Decimal;
  ativo: boolean;
  updatedAt: Date;
};
type VersaoMock = { id: string; tenantId: string; status: string; ativa: boolean };
type ContaMock = { id: string; isAnalitica: boolean };

function criarPrismaMock(viagem: ViagemMock, versao: VersaoMock, contas: ContaMock[]) {
  let atual = { ...viagem };

  const base = {
    viagem: {
      findFirst: vi.fn(() => Promise.resolve(atual.ativo ? atual : null)),
      findUniqueOrThrow: vi.fn(() => Promise.resolve(atual)),
      updateMany: vi.fn(({ where, data }: { where: { id: string; updatedAt: Date }; data: Partial<ViagemMock> }) => {
        if (atual.id !== where.id || atual.updatedAt.getTime() !== where.updatedAt.getTime()) {
          return Promise.resolve({ count: 0 });
        }
        atual = { ...atual, ...data, updatedAt: new Date(atual.updatedAt.getTime() + 1) };
        return Promise.resolve({ count: 1 });
      }),
    },
    versaoProposta: {
      findFirst: vi.fn(() => Promise.resolve(versao.ativa ? versao : null)),
    },
    contaContabil: {
      findMany: vi.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(contas.filter((c) => where.id.in.includes(c.id))),
      ),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base, getAtual: () => atual };
}

const viagemBase: ViagemMock = {
  id: 'via1',
  tenantId: 't1',
  versaoId: 'v1',
  metaId: 'm1',
  descricao: 'Viagem original',
  quantidadePessoas: 1,
  mediaDias: 2,
  custoUnitarioPassagem: new Prisma.Decimal(400),
  contaPassagemId: 'cp',
  custoUnitarioDiaria: new Prisma.Decimal(150),
  contaDiariaId: 'cd',
  custoUnitarioTransporte: new Prisma.Decimal(50),
  contaTransporteId: 'ct',
  custoEstimado: new Prisma.Decimal(750),
  ativo: true,
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};
const versaoRascunho: VersaoMock = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true };
const contaAnalitica = (id: string): ContaMock => ({ id, isAnalitica: true });

describe('EditarViagemUseCase [US-109]', () => {
  it('recalcula Custo Estimado e preserva vínculos com Proposta/Meta [Cenário 4]', async () => {
    const { base, getAtual } = criarPrismaMock(viagemBase, versaoRascunho, [
      contaAnalitica('cp'),
      contaAnalitica('cd'),
      contaAnalitica('ct'),
    ]);
    const useCase = new EditarViagemUseCase(base as never);

    const viagem = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      viagemId: 'via1',
      descricao: 'Viagem revisada',
      quantidadePessoas: 2,
      mediaDias: 2,
      custoUnitarioPassagem: 400,
      contaPassagemId: 'cp',
      custoUnitarioDiaria: 150,
      contaDiariaId: 'cd',
      custoUnitarioTransporte: 50,
      contaTransporteId: 'ct',
    });

    // (2*400) + (2*2*150) + (2*50) = 800 + 600 + 100 = 1500
    expect((viagem.custoEstimado as Prisma.Decimal).toString()).toBe('1500');
    expect(getAtual().versaoId).toBe('v1');
    expect(getAtual().metaId).toBe('m1');
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'VIAGEM_EDITADA' }) }),
    );
  });

  it('bloqueia conta sintética na edição', async () => {
    const { base } = criarPrismaMock(viagemBase, versaoRascunho, [
      { id: 'cp', isAnalitica: false },
      contaAnalitica('cd'),
      contaAnalitica('ct'),
    ]);
    const useCase = new EditarViagemUseCase(base as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        viagemId: 'via1',
        descricao: 'Viagem revisada',
        quantidadePessoas: 2,
        mediaDias: 2,
        custoUnitarioPassagem: 400,
        contaPassagemId: 'cp',
        custoUnitarioDiaria: 150,
        contaDiariaId: 'cd',
        custoUnitarioTransporte: 50,
        contaTransporteId: 'ct',
      }),
    ).rejects.toThrow(ContaViagemNaoAnaliticaError);
  });

  it('bloqueia conflito de concorrência quando o token informado diverge do estado atual [US-105]', async () => {
    const { base } = criarPrismaMock(viagemBase, versaoRascunho, [contaAnalitica('cp'), contaAnalitica('cd'), contaAnalitica('ct')]);
    const useCase = new EditarViagemUseCase(base as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        viagemId: 'via1',
        descricao: 'Viagem revisada',
        quantidadePessoas: 2,
        mediaDias: 2,
        custoUnitarioPassagem: 400,
        contaPassagemId: 'cp',
        custoUnitarioDiaria: 150,
        contaDiariaId: 'cd',
        custoUnitarioTransporte: 50,
        contaTransporteId: 'ct',
        tokenConcorrencia: new Date('2020-01-01T00:00:00Z'),
      }),
    ).rejects.toThrow(ConflitoConcorrenciaError);
    expect(base.viagem.updateMany).not.toHaveBeenCalled();
  });

  it('bloqueia conflito detectado só no updateMany (corrida real entre leitura e escrita) [US-105]', async () => {
    const { base } = criarPrismaMock(viagemBase, versaoRascunho, [contaAnalitica('cp'), contaAnalitica('cd'), contaAnalitica('ct')]);
    base.viagem.updateMany.mockResolvedValueOnce({ count: 0 });
    const useCase = new EditarViagemUseCase(base as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        viagemId: 'via1',
        descricao: 'Viagem revisada',
        quantidadePessoas: 2,
        mediaDias: 2,
        custoUnitarioPassagem: 400,
        contaPassagemId: 'cp',
        custoUnitarioDiaria: 150,
        contaDiariaId: 'cd',
        custoUnitarioTransporte: 50,
        contaTransporteId: 'ct',
      }),
    ).rejects.toThrow(ConflitoConcorrenciaError);
  });
});
