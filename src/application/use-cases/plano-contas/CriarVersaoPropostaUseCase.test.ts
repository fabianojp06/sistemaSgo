import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CriarVersaoPropostaUseCase } from './CriarVersaoPropostaUseCase';
import { VersaoPropostaInvalidaError } from '@/domain/plano-contas/errors';

function criarPrismaMock() {
  const versoes = [
    { id: 'v1', tenantId: 't1', propostaId: 'p1', numeroVersao: 1, vigente: true, ativa: true, status: 'RASCUNHO' },
  ];
  const valores = [{ tenantId: 't1', versaoId: 'v1', contaId: 'c7', exercicio: 2026, valor: new Prisma.Decimal(1000) }];

  const base = {
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          versoes.find(
            (v) => v.tenantId === where.tenantId && v.propostaId === where.propostaId && v.vigente === where.vigente && v.ativa === where.ativa,
          ) ?? null,
        ),
      ),
      update: vi.fn(({ where, data }: { where: { id: string }; data: { vigente: boolean } }) => {
        const v = versoes.find((x) => x.id === where.id);
        if (v) v.vigente = data.vigente;
        return Promise.resolve(v);
      }),
      create: vi.fn(({ data }: { data: Omit<(typeof versoes)[number], 'ativa' | 'status'> & { status: string } }) => {
        const nova = { ...data, ativa: true, id: 'v2' };
        versoes.push(nova as never);
        return Promise.resolve(nova);
      }),
    },
    valorOrcadoConta: {
      findMany: vi.fn(({ where }: { where: { tenantId: string; versaoId: string } }) =>
        Promise.resolve(valores.filter((v) => v.tenantId === where.tenantId && v.versaoId === where.versaoId)),
      ),
      createMany: vi.fn().mockResolvedValue({}),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

describe('CriarVersaoPropostaUseCase [US-007, Cenário 4]', () => {
  it('cria nova versão copiando os valores orçados da versão vigente', async () => {
    const prisma = criarPrismaMock();
    const useCase = new CriarVersaoPropostaUseCase(prisma as never);

    const novaVersao = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1' });

    expect(novaVersao.numeroVersao).toBe(2);
    expect(prisma.versaoProposta.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { vigente: false } });
    expect(prisma.valorOrcadoConta.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ versaoId: 'v2', contaId: 'c7', exercicio: 2026 })],
    });
  });

  it('bloqueia se a proposta não tiver versão vigente', async () => {
    const prisma = criarPrismaMock();
    prisma.versaoProposta.findFirst = vi.fn().mockResolvedValue(null);
    const useCase = new CriarVersaoPropostaUseCase(prisma as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1' })).rejects.toThrow(
      VersaoPropostaInvalidaError,
    );
  });
});
