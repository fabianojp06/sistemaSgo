import { describe, expect, it, vi } from 'vitest';
import { SincronizarPlanoContasUseCase } from './SincronizarPlanoContasUseCase';
import { AcessoNegadoSincronismoError, SincronismoEmAndamentoError } from '@/domain/plano-contas/errors';

function criarDependencias() {
  const prisma = { historicoOperacao: { create: vi.fn().mockResolvedValue({}) } };
  const provider = { buscarContasAtivas: vi.fn().mockResolvedValue([]) };
  const loader = { sincronizar: vi.fn().mockResolvedValue({ contasProcessadas: 0 }) };
  const lock = { tentarAdquirir: vi.fn().mockResolvedValue(true), liberar: vi.fn().mockResolvedValue(undefined) };

  return { prisma, provider, loader, lock };
}

describe('SincronizarPlanoContasUseCase [UC03.00 Fluxo Principal]', () => {
  it('rejeita usuário sem permissão administrativa [RNF_PLA_REQ_005, Cenário 6]', async () => {
    const { prisma, provider, loader, lock } = criarDependencias();
    const useCase = new SincronizarPlanoContasUseCase(prisma as never, provider as never, loader as never, lock as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', temPermissaoAdministrativa: false }),
    ).rejects.toThrow(AcessoNegadoSincronismoError);
    expect(lock.tentarAdquirir).not.toHaveBeenCalled();
  });

  it('rejeita sincronismo concorrente quando lock não é adquirido [RNF_PLA_REQ_007]', async () => {
    const { prisma, provider, loader, lock } = criarDependencias();
    lock.tentarAdquirir.mockResolvedValue(false);
    const useCase = new SincronizarPlanoContasUseCase(prisma as never, provider as never, loader as never, lock as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', temPermissaoAdministrativa: true }),
    ).rejects.toThrow(SincronismoEmAndamentoError);
    expect(provider.buscarContasAtivas).not.toHaveBeenCalled();
  });

  it('sincroniza, grava auditoria SYNC_PLANO_CONTAS e sempre libera o lock [RN_PLA_004]', async () => {
    const { prisma, provider, loader, lock } = criarDependencias();
    const useCase = new SincronizarPlanoContasUseCase(prisma as never, provider as never, loader as never, lock as never);

    const resultado = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', temPermissaoAdministrativa: true });

    expect(resultado.contasProcessadas).toBe(0);
    expect(loader.sincronizar).toHaveBeenCalledWith('t1', []);
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'SYNC_PLANO_CONTAS' }) }),
    );
    expect(lock.liberar).toHaveBeenCalledWith('t1');
  });

  it('libera o lock e audita a falha mesmo quando o loader lança erro [RNF_PLA_REQ_004 rollback]', async () => {
    const { prisma, provider, loader, lock } = criarDependencias();
    loader.sincronizar.mockRejectedValue(new Error('falha simulada'));
    const useCase = new SincronizarPlanoContasUseCase(prisma as never, provider as never, loader as never, lock as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', temPermissaoAdministrativa: true }),
    ).rejects.toThrow('falha simulada');

    expect(lock.liberar).toHaveBeenCalledWith('t1');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dadosSerializados: { erro: 'falha simulada' } }) }),
    );
  });
});
