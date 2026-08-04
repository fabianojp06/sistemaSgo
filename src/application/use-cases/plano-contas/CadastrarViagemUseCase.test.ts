import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { CadastrarViagemUseCase } from './CadastrarViagemUseCase';
import { CamposObrigatoriosViagemError, ContaViagemNaoAnaliticaError, MetaNaoEncontradaError, ViagemForaDeEscopoCategoriaError } from '@/domain/plano-contas/errors';

type VersaoMock = { id: string; tenantId: string; status: string; ativa: boolean; proposta: { categoria: string } };
type ContaMock = { id: string; isAnalitica: boolean };
type MetaMock = { id: string; tenantId: string; versaoId: string; ativo: boolean };

function criarPrismaMock(versoes: VersaoMock[], metas: MetaMock[], contas: ContaMock[]) {
  let idSeq = 1;

  const base = {
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string; ativa: boolean } }) =>
        Promise.resolve(versoes.find((v) => v.id === where.id && v.tenantId === where.tenantId && v.ativa) ?? null),
      ),
    },
    meta: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; versaoId: string; ativo: boolean } }) =>
        Promise.resolve(metas.find((m) => m.versaoId === where.versaoId && m.tenantId === where.tenantId && m.ativo === where.ativo) ?? null),
      ),
    },
    contaContabil: {
      findMany: vi.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(contas.filter((c) => where.id.in.includes(c.id))),
      ),
    },
    viagem: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: `viagem${idSeq++}`, ativo: true, ...data })),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const versaoPorMeta: VersaoMock = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true, proposta: { categoria: 'POR_META' } };
const versaoConsolidada: VersaoMock = { id: 'v2', tenantId: 't1', status: 'RASCUNHO', ativa: true, proposta: { categoria: 'CONSOLIDADA' } };
const metaAtiva: MetaMock = { id: 'm1', tenantId: 't1', versaoId: 'v1', ativo: true };
const contaAnalitica = (id: string): ContaMock => ({ id, isAnalitica: true });
const contaSintetica = (id: string): ContaMock => ({ id, isAnalitica: false });

const inputBase = {
  tenantId: 't1',
  usuarioId: 'u1',
  versaoId: 'v1',
  descricao: 'Missão técnica em Brasília',
  quantidadePessoas: 2,
  mediaDias: 3,
  custoUnitarioPassagem: 500,
  contaPassagemId: 'cp',
  custoUnitarioDiaria: 200,
  contaDiariaId: 'cd',
  custoUnitarioTransporte: 100,
  contaTransporteId: 'ct',
};

describe('CadastrarViagemUseCase [US-109]', () => {
  it('cadastra a Viagem com Custo Estimado calculado [Cenário 1]', async () => {
    const prisma = criarPrismaMock(
      [versaoPorMeta],
      [metaAtiva],
      [contaAnalitica('cp'), contaAnalitica('cd'), contaAnalitica('ct')],
    );
    const useCase = new CadastrarViagemUseCase(prisma as never);

    const viagem = await useCase.execute(inputBase);

    // (2*500) + (2*3*200) + (2*100) = 1000 + 1200 + 200 = 2400
    expect((viagem.custoEstimado as Prisma.Decimal).toString()).toBe('2400');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'VIAGEM_CRIADA' }) }),
    );
  });

  it('bloqueia Viagem em Proposta CONSOLIDADA (sem Meta) [Cenário 2]', async () => {
    const prisma = criarPrismaMock([versaoConsolidada], [], []);
    const useCase = new CadastrarViagemUseCase(prisma as never);

    await expect(useCase.execute({ ...inputBase, versaoId: 'v2' })).rejects.toThrow(ViagemForaDeEscopoCategoriaError);
  });

  it('bloqueia quando a Versão não tem Meta ativa cadastrada', async () => {
    const prisma = criarPrismaMock([versaoPorMeta], [], []);
    const useCase = new CadastrarViagemUseCase(prisma as never);

    await expect(useCase.execute(inputBase)).rejects.toThrow(MetaNaoEncontradaError);
  });

  it('bloqueia conta sintética em qualquer uma das 3 subcontas [Cenário 3]', async () => {
    const prisma = criarPrismaMock(
      [versaoPorMeta],
      [metaAtiva],
      [contaSintetica('cp'), contaAnalitica('cd'), contaAnalitica('ct')],
    );
    const useCase = new CadastrarViagemUseCase(prisma as never);

    await expect(useCase.execute(inputBase)).rejects.toThrow(ContaViagemNaoAnaliticaError);
  });

  it('bloqueia campos obrigatórios ausentes', async () => {
    const prisma = criarPrismaMock([versaoPorMeta], [metaAtiva], []);
    const useCase = new CadastrarViagemUseCase(prisma as never);

    await expect(useCase.execute({ ...inputBase, descricao: '' })).rejects.toThrow(CamposObrigatoriosViagemError);
  });
});
