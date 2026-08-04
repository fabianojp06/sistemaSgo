import { describe, expect, it, vi } from 'vitest';
import { ExcluirQtdeEmpregadoUseCase } from './ExcluirQtdeEmpregadoUseCase';
import { QtdeEmpregadoNaoEncontradaError, QtdeEmpregadoPropostaImutavelError } from '@/domain/plano-contas/errors';

type QtdeMock = { id: string; tenantId: string; propostaId: string; numeroDocumento: string; ativo: boolean };
type PropostaMock = { id: string; tenantId: string; status: string };

function criarPrismaMock(qtde: QtdeMock | null, proposta: PropostaMock) {
  let atual = qtde ? { ...qtde } : null;

  const base = {
    qtdeEmpregado: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string; ativo: boolean } }) =>
        Promise.resolve(atual && atual.tenantId === where.tenantId && atual.id === where.id && atual.ativo ? atual : null),
      ),
      update: vi.fn(({ data }: { data: Partial<QtdeMock> }) => {
        atual = { ...(atual as QtdeMock), ...data };
        return Promise.resolve(atual);
      }),
    },
    proposta: {
      findFirst: vi.fn(() => Promise.resolve(proposta)),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base, getAtual: () => atual };
}

describe('ExcluirQtdeEmpregadoUseCase [US-113]', () => {
  it('exclui via soft delete [Cenário 7]', async () => {
    const qtde: QtdeMock = { id: 'q1', tenantId: 't1', propostaId: 'p1', numeroDocumento: 'APOST-2026-014', ativo: true };
    const proposta: PropostaMock = { id: 'p1', tenantId: 't1', status: 'RASCUNHO' };
    const { base, getAtual } = criarPrismaMock(qtde, proposta);
    const useCase = new ExcluirQtdeEmpregadoUseCase(base as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', qtdeEmpregadoId: 'q1' });

    expect(getAtual()?.ativo).toBe(false);
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'QTDE_EMPREGADO_EXCLUIDA' }) }),
    );
  });

  it('bloqueia exclusão quando a Proposta não está em RASCUNHO/EM_ELABORACAO [Cenário 6]', async () => {
    const qtde: QtdeMock = { id: 'q1', tenantId: 't1', propostaId: 'p1', numeroDocumento: 'APOST-2026-014', ativo: true };
    const proposta: PropostaMock = { id: 'p1', tenantId: 't1', status: 'OFICIALIZADO' };
    const { base } = criarPrismaMock(qtde, proposta);
    const useCase = new ExcluirQtdeEmpregadoUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', qtdeEmpregadoId: 'q1' })).rejects.toThrow(
      QtdeEmpregadoPropostaImutavelError,
    );
  });

  it('bloqueia exclusão de registro inexistente', async () => {
    const proposta: PropostaMock = { id: 'p1', tenantId: 't1', status: 'RASCUNHO' };
    const { base } = criarPrismaMock(null, proposta);
    const useCase = new ExcluirQtdeEmpregadoUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', qtdeEmpregadoId: 'inexistente' })).rejects.toThrow(
      QtdeEmpregadoNaoEncontradaError,
    );
  });
});
