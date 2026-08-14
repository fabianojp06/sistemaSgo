import { describe, expect, it, vi } from 'vitest';
import { InativarUnidadeFuncionalUseCase } from './InativarUnidadeFuncionalUseCase';
import { InativacaoUnidadeFuncionalBloqueadaError, PropostaImutavelError, VersaoPropostaInvalidaError } from '@/domain/plano-contas/errors';

type PropostaMock = { id: string; tenantId: string; status: string };
type UnidadeMock = { id: string; tenantId: string; propostaId: string; nome: string; ativa: boolean };

function criarPrismaMock(propostas: PropostaMock[], unidades: UnidadeMock[]) {
  const propostasPorId = new Map(propostas.map((p) => [p.id, p]));

  const base = {
    unidadeFuncional: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string; ativa: boolean } }) => {
        const u = unidades.find((x) => x.id === where.id);
        if (!u || u.tenantId !== where.tenantId || u.ativa !== where.ativa) return Promise.resolve(null);
        return Promise.resolve(u);
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: { ativa: boolean } }) => {
        const u = unidades.find((x) => x.id === where.id);
        if (u) u.ativa = data.ativa;
        return Promise.resolve(u);
      }),
    },
    proposta: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        const p = propostasPorId.get(where.id);
        return Promise.resolve(p && p.tenantId === where.tenantId ? p : null);
      }),
    },
    cargo: {
      count: vi.fn().mockResolvedValue(0),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return base;
}

const propostaRascunho: PropostaMock = { id: 'p1', tenantId: 't1', status: 'RASCUNHO' };
const propostaOficializada: PropostaMock = { id: 'p2', tenantId: 't1', status: 'OFICIALIZADO' };

describe('InativarUnidadeFuncionalUseCase [US-106]', () => {
  it('inativa unidade sem vínculo de cargo [Cenário 6]', async () => {
    const unidade: UnidadeMock = { id: 'u1', tenantId: 't1', propostaId: 'p1', nome: 'Setor X', ativa: true };
    const prisma = criarPrismaMock([propostaRascunho], [unidade]);
    const useCase = new InativarUnidadeFuncionalUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', unidadeId: 'u1' });

    expect(prisma.unidadeFuncional.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { ativa: false } });
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'UNIDADE_FUNCIONAL_INATIVADA' }) }),
    );
  });

  it('bloqueia inativação em Proposta não Rascunho/Em Elaboração [Cenário 7]', async () => {
    const unidade: UnidadeMock = { id: 'u2', tenantId: 't1', propostaId: 'p2', nome: 'Setor Y', ativa: true };
    const prisma = criarPrismaMock([propostaOficializada], [unidade]);
    const useCase = new InativarUnidadeFuncionalUseCase(prisma as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', unidadeId: 'u2' })).rejects.toThrow(PropostaImutavelError);
    expect(prisma.unidadeFuncional.update).not.toHaveBeenCalled();
  });

  it('bloqueia se a unidade não existir/já estiver inativa', async () => {
    const prisma = criarPrismaMock([propostaRascunho], []);
    const useCase = new InativarUnidadeFuncionalUseCase(prisma as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', unidadeId: 'inexistente' })).rejects.toThrow(
      VersaoPropostaInvalidaError,
    );
  });

  it('bloqueia inativação com vínculo de cargo (via override do método isolado) [Cenário 5]', async () => {
    const unidade: UnidadeMock = { id: 'u3', tenantId: 't1', propostaId: 'p1', nome: 'Setor Z', ativa: true };
    const prisma = criarPrismaMock([propostaRascunho], [unidade]);
    const useCase = new InativarUnidadeFuncionalUseCase(prisma as never);
    // Simula o dia em que Cargo existir e a checagem passar a encontrar vínculos.
    Object.defineProperty(useCase, 'contarCargosVinculados', { value: () => Promise.resolve(3) });

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', unidadeId: 'u3' })).rejects.toThrow(
      InativacaoUnidadeFuncionalBloqueadaError,
    );
  });
});
