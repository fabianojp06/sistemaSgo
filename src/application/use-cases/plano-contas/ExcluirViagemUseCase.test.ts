import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ExcluirViagemUseCase } from './ExcluirViagemUseCase';
import { ViagemNaoEncontradaError, ViagemPropostaEmAprovacaoError } from '@/domain/plano-contas/errors';

type ViagemMock = { id: string; tenantId: string; versaoId: string; descricao: string; custoEstimado: Prisma.Decimal; ativo: boolean };
type VersaoMock = { id: string; tenantId: string; status: string; ativa: boolean };

function criarPrismaMock(viagem: ViagemMock | null, versao: VersaoMock) {
  let atual = viagem ? { ...viagem } : null;

  const base = {
    viagem: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string; ativo: boolean } }) =>
        Promise.resolve(atual && atual.tenantId === where.tenantId && atual.id === where.id && atual.ativo ? atual : null),
      ),
      update: vi.fn(({ data }: { data: Partial<ViagemMock> }) => {
        atual = { ...(atual as ViagemMock), ...data };
        return Promise.resolve(atual);
      }),
    },
    versaoProposta: {
      findFirst: vi.fn(() => Promise.resolve(versao.ativa ? versao : null)),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base, getAtual: () => atual };
}

describe('ExcluirViagemUseCase [US-109]', () => {
  it('exclui a Viagem via soft delete quando a Proposta está em RASCUNHO [Cenário 6]', async () => {
    const viagem: ViagemMock = { id: 'via1', tenantId: 't1', versaoId: 'v1', descricao: 'Viagem 1', custoEstimado: new Prisma.Decimal(2400), ativo: true };
    const versao: VersaoMock = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true };
    const { base, getAtual } = criarPrismaMock(viagem, versao);
    const useCase = new ExcluirViagemUseCase(base as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', viagemId: 'via1' });

    expect(getAtual()?.ativo).toBe(false);
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'VIAGEM_EXCLUIDA' }) }),
    );
  });

  it('bloqueia exclusão quando a Proposta já foi enviada para aprovação [Cenário 5]', async () => {
    const viagem: ViagemMock = { id: 'via1', tenantId: 't1', versaoId: 'v1', descricao: 'Viagem 1', custoEstimado: new Prisma.Decimal(2400), ativo: true };
    const versao: VersaoMock = { id: 'v1', tenantId: 't1', status: 'EM_ELABORACAO', ativa: true };
    const { base } = criarPrismaMock(viagem, versao);
    const useCase = new ExcluirViagemUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', viagemId: 'via1' })).rejects.toThrow(ViagemPropostaEmAprovacaoError);
  });

  it('bloqueia exclusão de Viagem inexistente', async () => {
    const versao: VersaoMock = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true };
    const { base } = criarPrismaMock(null, versao);
    const useCase = new ExcluirViagemUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', viagemId: 'inexistente' })).rejects.toThrow(ViagemNaoEncontradaError);
  });
});
