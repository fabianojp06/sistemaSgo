import { describe, expect, it, vi } from 'vitest';
import { SincronizarUsuarioClerkUseCase } from './SincronizarUsuarioClerkUseCase';

function criarPrismaMock() {
  return { usuario: { upsert: vi.fn().mockResolvedValue({}) } };
}

describe('SincronizarUsuarioClerkUseCase', () => {
  it('faz upsert por clerkUserId, criando no primeiro evento e atualizando nos seguintes', async () => {
    const prisma = criarPrismaMock();
    const useCase = new SincronizarUsuarioClerkUseCase(prisma as never);

    await useCase.execute({
      clerkUserId: 'clerk-1',
      tenantId: 'default',
      nomeCompleto: 'Fabiano Garcia',
      email: 'fabiano@example.com',
    });

    expect(prisma.usuario.upsert).toHaveBeenCalledWith({
      where: { clerkUserId: 'clerk-1' },
      update: { nomeCompleto: 'Fabiano Garcia', email: 'fabiano@example.com' },
      create: {
        clerkUserId: 'clerk-1',
        tenantId: 'default',
        nomeCompleto: 'Fabiano Garcia',
        email: 'fabiano@example.com',
      },
    });
  });
});
