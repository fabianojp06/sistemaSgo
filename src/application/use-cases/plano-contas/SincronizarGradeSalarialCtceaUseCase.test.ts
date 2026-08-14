import { describe, expect, it, vi } from 'vitest';
import { SincronizarGradeSalarialCtceaUseCase } from './SincronizarGradeSalarialCtceaUseCase';
import {
  AcessoNegadoSincronismoGradeSalarialCtceaError,
  SincronismoGradeSalarialCtceaEmAndamentoError,
} from '@/domain/plano-contas/errors';

function criarDependencias() {
  const prisma = { historicoOperacao: { create: vi.fn().mockResolvedValue({}) } };
  const provider = { buscarGradeAtiva: vi.fn().mockResolvedValue([]) };
  const loader = { sincronizar: vi.fn().mockResolvedValue({ linhasProcessadas: 0 }) };
  const lock = { tentarAdquirir: vi.fn().mockResolvedValue(true), liberar: vi.fn().mockResolvedValue(undefined) };

  return { prisma, provider, loader, lock };
}

describe('SincronizarGradeSalarialCtceaUseCase [ADR-046/US-137]', () => {
  it('rejeita usuário sem permissão administrativa', async () => {
    const { prisma, provider, loader, lock } = criarDependencias();
    const useCase = new SincronizarGradeSalarialCtceaUseCase(prisma as never, provider as never, loader as never, lock as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', temPermissaoAdministrativa: false }),
    ).rejects.toThrow(AcessoNegadoSincronismoGradeSalarialCtceaError);
    expect(lock.tentarAdquirir).not.toHaveBeenCalled();
  });

  it('rejeita sincronismo concorrente quando lock não é adquirido', async () => {
    const { prisma, provider, loader, lock } = criarDependencias();
    lock.tentarAdquirir.mockResolvedValue(false);
    const useCase = new SincronizarGradeSalarialCtceaUseCase(prisma as never, provider as never, loader as never, lock as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', temPermissaoAdministrativa: true }),
    ).rejects.toThrow(SincronismoGradeSalarialCtceaEmAndamentoError);
    expect(provider.buscarGradeAtiva).not.toHaveBeenCalled();
  });

  it('sincroniza, grava auditoria SYNC_GRADE_SALARIAL_CTCEA e sempre libera o lock (Cenário 1)', async () => {
    const { prisma, provider, loader, lock } = criarDependencias();
    const useCase = new SincronizarGradeSalarialCtceaUseCase(prisma as never, provider as never, loader as never, lock as never);

    const resultado = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', temPermissaoAdministrativa: true });

    expect(resultado.linhasProcessadas).toBe(0);
    expect(loader.sincronizar).toHaveBeenCalledWith('t1', []);
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'SYNC_GRADE_SALARIAL_CTCEA' }) }),
    );
    expect(lock.liberar).toHaveBeenCalledWith('t1');
  });

  it('libera o lock e audita a falha mesmo quando o loader lança erro', async () => {
    const { prisma, provider, loader, lock } = criarDependencias();
    loader.sincronizar.mockRejectedValue(new Error('falha simulada'));
    const useCase = new SincronizarGradeSalarialCtceaUseCase(prisma as never, provider as never, loader as never, lock as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', temPermissaoAdministrativa: true }),
    ).rejects.toThrow('falha simulada');

    expect(lock.liberar).toHaveBeenCalledWith('t1');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dadosSerializados: { erro: 'falha simulada' } }) }),
    );
  });
});
