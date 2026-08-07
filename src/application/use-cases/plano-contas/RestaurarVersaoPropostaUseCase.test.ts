import { describe, expect, it, vi } from 'vitest';
import { RestaurarVersaoPropostaUseCase } from './RestaurarVersaoPropostaUseCase';
import { VersaoPropostaInvalidaError, VersaoJaVigenteError } from '@/domain/plano-contas/errors';

function criarPrismaMock() {
  const versoes = [
    { id: 'v1', tenantId: 't1', propostaId: 'p1', numeroVersao: 1, vigente: false, ativa: true },
    { id: 'v2', tenantId: 't1', propostaId: 'p1', numeroVersao: 2, vigente: false, ativa: false },
    { id: 'v3', tenantId: 't1', propostaId: 'p1', numeroVersao: 3, vigente: true, ativa: true },
  ];

  const base = {
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          versoes.find((v) => {
            if (where.id !== undefined && v.id !== where.id) return false;
            if (where.tenantId !== undefined && v.tenantId !== where.tenantId) return false;
            if (where.propostaId !== undefined && v.propostaId !== where.propostaId) return false;
            if (where.vigente !== undefined && v.vigente !== where.vigente) return false;
            if (where.ativa !== undefined && v.ativa !== where.ativa) return false;
            return true;
          }) ?? null,
        ),
      ),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<(typeof versoes)[number]> }) => {
        const v = versoes.find((x) => x.id === where.id);
        if (v) Object.assign(v, data);
        return Promise.resolve(v);
      }),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

describe('RestaurarVersaoPropostaUseCase [US-120, ADR-034]', () => {
  it('restaura versão ativa como vigente, rebaixando a vigente atual', async () => {
    const prisma = criarPrismaMock();
    const useCase = new RestaurarVersaoPropostaUseCase(prisma as never);

    const resultado = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1', versaoRestauradaId: 'v1' });

    expect(resultado.vigente).toBe(true);
    expect(prisma.versaoProposta.update).toHaveBeenCalledWith({ where: { id: 'v3' }, data: { vigente: false } });
    expect(prisma.versaoProposta.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { vigente: true, ativa: true } });
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoOperacao: 'VERSAO_PROPOSTA_RESTAURADA',
          dadosSerializados: expect.objectContaining({ versaoRestauradaId: 'v1', versaoAnteriorId: 'v3' }),
        }),
      }),
    );
  });

  it('restaura versão excluída (ativa=false), reativando-a', async () => {
    const prisma = criarPrismaMock();
    const useCase = new RestaurarVersaoPropostaUseCase(prisma as never);

    const resultado = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1', versaoRestauradaId: 'v2' });

    expect(resultado.vigente).toBe(true);
    expect(resultado.ativa).toBe(true);
  });

  it('bloqueia se a versão-alvo já é a vigente', async () => {
    const prisma = criarPrismaMock();
    const useCase = new RestaurarVersaoPropostaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1', versaoRestauradaId: 'v3' }),
    ).rejects.toThrow(VersaoJaVigenteError);
  });

  it('bloqueia se a versão-alvo não existe', async () => {
    const prisma = criarPrismaMock();
    const useCase = new RestaurarVersaoPropostaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1', versaoRestauradaId: 'inexistente' }),
    ).rejects.toThrow(VersaoPropostaInvalidaError);
  });
});
