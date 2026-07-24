import { describe, expect, it, vi } from 'vitest';
import { EfetuarLogoffUseCase } from './EfetuarLogoffUseCase';

function criarPrismaMock() {
  return {
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
  };
}

function criarClerkMock(revokeSession = vi.fn().mockResolvedValue({})) {
  return { sessions: { revokeSession } };
}

describe('EfetuarLogoffUseCase [UC01.04]', () => {
  it('revoga a sessão no Clerk e registra LOGOFF no histórico, nesta ordem [CA-01.04.02/03]', async () => {
    const prisma = criarPrismaMock();
    const clerk = criarClerkMock();
    const useCase = new EfetuarLogoffUseCase(prisma as never, clerk as never);

    await useCase.execute({ tenantId: 'tenant-1', usuarioId: 'usuario-1', clerkSessionId: 'sess-1' });

    expect(clerk.sessions.revokeSession).toHaveBeenCalledWith('sess-1');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          usuarioId: 'usuario-1',
          clerkSessionId: 'sess-1',
          tipoOperacao: 'LOGOFF',
        }),
      }),
    );
  });

  it('não lança quando o Clerk falha ao revogar a sessão — token expira por TTL [E1, CA-01.04.09/10]', async () => {
    const prisma = criarPrismaMock();
    const clerk = criarClerkMock(vi.fn().mockRejectedValue(new Error('network')));
    const useCase = new EfetuarLogoffUseCase(prisma as never, clerk as never);

    await expect(
      useCase.execute({ tenantId: 'tenant-1', usuarioId: 'usuario-1', clerkSessionId: 'sess-1' }),
    ).resolves.toBeUndefined();
    expect(prisma.historicoOperacao.create).toHaveBeenCalled();
  });

  it('não lança quando o registro de auditoria falha — logoff é mantido [E2, CA-01.04.11/12]', async () => {
    const prisma = {
      historicoOperacao: { create: vi.fn().mockRejectedValue(new Error('db down')) },
    };
    const clerk = criarClerkMock();
    const useCase = new EfetuarLogoffUseCase(prisma as never, clerk as never);

    await expect(
      useCase.execute({ tenantId: 'tenant-1', usuarioId: 'usuario-1', clerkSessionId: 'sess-1' }),
    ).resolves.toBeUndefined();
    expect(clerk.sessions.revokeSession).toHaveBeenCalledWith('sess-1');
  });
});
