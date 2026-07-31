import { describe, expect, it, vi } from 'vitest';
import { CriarUnidadeFuncionalUseCase } from './CriarUnidadeFuncionalUseCase';
import { PropostaImutavelError, PropostaNaoEncontradaError, VinculoHierarquicoInvalidoError } from '@/domain/plano-contas/errors';

type PropostaMock = { id: string; tenantId: string; status: string };
type UnidadeMock = { id: string; tenantId: string; propostaId: string; tipoNivel: string; idPai: string | null; ativa: boolean };

function criarPrismaMock(propostas: PropostaMock[], unidades: UnidadeMock[] = []) {
  const propostasPorId = new Map(propostas.map((p) => [p.id, p]));
  let idSeq = 1;

  const base = {
    proposta: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        const p = propostasPorId.get(where.id);
        return Promise.resolve(p && p.tenantId === where.tenantId ? p : null);
      }),
    },
    unidadeFuncional: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string; propostaId: string } }) =>
        Promise.resolve(
          unidades.find((u) => u.id === where.id && u.tenantId === where.tenantId && u.propostaId === where.propostaId) ??
            null,
        ),
      ),
      create: vi.fn(({ data }: { data: Omit<UnidadeMock, 'id' | 'ativa'> }) => {
        const nova = { id: `u${idSeq++}`, ativa: true, ...data };
        unidades.push(nova);
        return Promise.resolve(nova);
      }),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const propostaRascunho: PropostaMock = { id: 'p1', tenantId: 't1', status: 'RASCUNHO' };
const propostaOficializada: PropostaMock = { id: 'p2', tenantId: 't1', status: 'OFICIALIZADO' };

describe('CriarUnidadeFuncionalUseCase [US-106]', () => {
  it('cria unidade Sintética raiz sem pai [Cenário 1]', async () => {
    const prisma = criarPrismaMock([propostaRascunho]);
    const useCase = new CriarUnidadeFuncionalUseCase(prisma as never);

    const unidade = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      nome: 'Diretoria Executiva',
      tipoNivel: 'SINTETICO_DIRETORIA',
    });

    expect(unidade.idPai).toBeNull();
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'UNIDADE_FUNCIONAL_CRIADA' }) }),
    );
  });

  it('cria unidade Analítica sob o pai correto [Cenário 2]', async () => {
    const diretoria: UnidadeMock = { id: 'ud1', tenantId: 't1', propostaId: 'p1', tipoNivel: 'SINTETICO_DIRETORIA', idPai: null, ativa: true };
    const prisma = criarPrismaMock([propostaRascunho], [diretoria]);
    const useCase = new CriarUnidadeFuncionalUseCase(prisma as never);

    const unidade = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      nome: 'Assessoria de Planejamento',
      tipoNivel: 'ANALITICO_ASSESSOR',
      idPai: 'ud1',
    });

    expect(unidade.idPai).toBe('ud1');
  });

  it('bloqueia Coordenadoria sob Diretoria (vínculo hierárquico inválido) [Cenário 3]', async () => {
    const diretoria: UnidadeMock = { id: 'ud1', tenantId: 't1', propostaId: 'p1', tipoNivel: 'SINTETICO_DIRETORIA', idPai: null, ativa: true };
    const prisma = criarPrismaMock([propostaRascunho], [diretoria]);
    const useCase = new CriarUnidadeFuncionalUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        nome: 'Coordenadoria X',
        tipoNivel: 'ANALITICO_COORDENADORIA',
        idPai: 'ud1',
      }),
    ).rejects.toThrow(VinculoHierarquicoInvalidoError);
    expect(prisma.unidadeFuncional.create).not.toHaveBeenCalled();
  });

  it('bloqueia Analítico sem idPai informado', async () => {
    const prisma = criarPrismaMock([propostaRascunho]);
    const useCase = new CriarUnidadeFuncionalUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1', nome: 'Setor Y', tipoNivel: 'ANALITICO_SETOR' }),
    ).rejects.toThrow(VinculoHierarquicoInvalidoError);
  });

  it('bloqueia escrita em Proposta não Rascunho/Em Elaboração [Cenário 7]', async () => {
    const prisma = criarPrismaMock([propostaOficializada]);
    const useCase = new CriarUnidadeFuncionalUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p2', nome: 'Diretoria', tipoNivel: 'SINTETICO_DIRETORIA' }),
    ).rejects.toThrow(PropostaImutavelError);
  });

  it('bloqueia se a Proposta não existir', async () => {
    const prisma = criarPrismaMock([propostaRascunho]);
    const useCase = new CriarUnidadeFuncionalUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'inexistente', nome: 'X', tipoNivel: 'SINTETICO_GERENCIA' }),
    ).rejects.toThrow(PropostaNaoEncontradaError);
  });
});
