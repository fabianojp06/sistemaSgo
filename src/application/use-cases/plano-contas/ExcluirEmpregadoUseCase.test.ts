import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ExcluirEmpregadoUseCase } from './ExcluirEmpregadoUseCase';
import { EmpregadoNaoEncontradoError } from '@/domain/plano-contas/errors';

type EmpregadoMock = { id: string; tenantId: string; propostaId: string; nome: string; custoTotalMensal: Prisma.Decimal; ativo: boolean };
type PropostaMock = { id: string; tenantId: string; status: string };

function criarPrismaMock(empregado: EmpregadoMock | null, proposta: PropostaMock) {
  let atual = empregado ? { ...empregado } : null;

  const base = {
    empregadoHeadcount: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string; ativo: boolean } }) =>
        Promise.resolve(atual && atual.tenantId === where.tenantId && atual.id === where.id && atual.ativo ? atual : null),
      ),
      update: vi.fn(({ data }: { data: Partial<EmpregadoMock> }) => {
        atual = { ...(atual as EmpregadoMock), ...data };
        return Promise.resolve(atual);
      }),
    },
    proposta: { findFirst: vi.fn(() => Promise.resolve(proposta)) },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base, getAtual: () => atual };
}

describe('ExcluirEmpregadoUseCase [US-108]', () => {
  it('exclui o Empregado via soft delete [Cenário 8]', async () => {
    const empregado: EmpregadoMock = {
      id: 'e1',
      tenantId: 't1',
      propostaId: 'p1',
      nome: 'João Souza',
      custoTotalMensal: new Prisma.Decimal(6200),
      ativo: true,
    };
    const proposta: PropostaMock = { id: 'p1', tenantId: 't1', status: 'RASCUNHO' };
    const { base, getAtual } = criarPrismaMock(empregado, proposta);
    const useCase = new ExcluirEmpregadoUseCase(base as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', empregadoId: 'e1' });

    expect(getAtual()?.ativo).toBe(false);
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'EMPREGADO_EXCLUIDO' }) }),
    );
  });

  it('bloqueia exclusão de Empregado inexistente', async () => {
    const proposta: PropostaMock = { id: 'p1', tenantId: 't1', status: 'RASCUNHO' };
    const { base } = criarPrismaMock(null, proposta);
    const useCase = new ExcluirEmpregadoUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', empregadoId: 'inexistente' })).rejects.toThrow(
      EmpregadoNaoEncontradoError,
    );
  });

  it('bloqueia exclusão quando a Proposta está oficializada [Cenário 10]', async () => {
    const empregado: EmpregadoMock = {
      id: 'e1',
      tenantId: 't1',
      propostaId: 'p1',
      nome: 'João Souza',
      custoTotalMensal: new Prisma.Decimal(6200),
      ativo: true,
    };
    const proposta: PropostaMock = { id: 'p1', tenantId: 't1', status: 'OFICIALIZADO' };
    const { base } = criarPrismaMock(empregado, proposta);
    const useCase = new ExcluirEmpregadoUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', empregadoId: 'e1' })).rejects.toThrow(/congelados/);
  });
});
