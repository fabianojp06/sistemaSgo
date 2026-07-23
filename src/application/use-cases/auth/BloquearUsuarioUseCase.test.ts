import { describe, expect, it, vi } from 'vitest';
import { BloquearUsuarioUseCase } from './BloquearUsuarioUseCase';

function criarPrismaMock() {
  return {
    usuario: { update: vi.fn().mockResolvedValue({}) },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
}

describe('BloquearUsuarioUseCase [UC01.05]', () => {
  it('grava bloqueado=true e historico BLOQUEIO_AUTOMATICO para usuário ATIVO [RN0024]', async () => {
    const prisma = criarPrismaMock();
    const useCase = new BloquearUsuarioUseCase(prisma as never);

    await useCase.execute({
      tenantId: 'tenant-1',
      usuarioId: 'usuario-1',
      status: 'ATIVO',
      quantidadeTentativas: 5,
    });

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'usuario-1' },
      data: { bloqueado: true },
    });
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipoOperacao: 'BLOQUEIO_AUTOMATICO', quantidadeTentativas: 5 }),
      }),
    );
  });

  it('não bloqueia contas INATIVAS — bloqueio seria redundante [RN0032, CA-01.05.07]', async () => {
    const prisma = criarPrismaMock();
    const useCase = new BloquearUsuarioUseCase(prisma as never);

    await useCase.execute({
      tenantId: 'tenant-1',
      usuarioId: 'usuario-1',
      status: 'INATIVO',
      quantidadeTentativas: 5,
    });

    expect(prisma.usuario.update).not.toHaveBeenCalled();
    expect(prisma.historicoOperacao.create).not.toHaveBeenCalled();
  });
});
