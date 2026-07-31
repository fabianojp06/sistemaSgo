import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));
vi.mock('@/infrastructure/tenant', () => ({
  getTenantId: vi.fn(),
}));
vi.mock('@/infrastructure/db/prisma', () => ({
  prisma: { usuario: { findFirst: vi.fn() } },
}));
vi.mock('@/application/use-cases/plano-contas/verificarPermissao', () => ({
  usuarioTemFuncionalidade: vi.fn(),
}));
vi.mock('@/application/use-cases/plano-contas/container', () => ({
  getSincronizarPlanoContasUseCase: vi.fn(),
  getCriarAgrupadorUseCase: vi.fn(),
  getEditarAgrupadorUseCase: vi.fn(),
  getExcluirAgrupadorUseCase: vi.fn(),
  getAtribuirNaturezaContaUseCase: vi.fn(),
  getConfigurarValorOrcadoContaUseCase: vi.fn(),
  getCriarVersaoPropostaUseCase: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';
import { getTenantId } from '@/infrastructure/tenant';
import { prisma } from '@/infrastructure/db/prisma';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import { getConfigurarValorOrcadoContaUseCase } from '@/application/use-cases/plano-contas/container';
import { configurarValorOrcadoConta } from './actions';

describe('configurarValorOrcadoConta [US-007]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'clerk_1' } as never);
    vi.mocked(getTenantId).mockResolvedValue('t1');
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue({ id: 'u1' } as never);
  });

  it('bloqueia usuário sem a funcionalidade "plano-contas.configurar-valor-orcado" [Cenário de permissão]', async () => {
    vi.mocked(usuarioTemFuncionalidade).mockResolvedValue(false);
    const executeMock = vi.fn();
    vi.mocked(getConfigurarValorOrcadoContaUseCase).mockReturnValue({ execute: executeMock } as never);

    const resultado = await configurarValorOrcadoConta('v1', 'c7', 2026, '50000.00');

    expect(resultado).toEqual({
      sucesso: false,
      mensagem: 'Você não tem permissão para configurar valores orçados.',
    });
    expect(usuarioTemFuncionalidade).toHaveBeenCalledWith(prisma, 't1', 'u1', 'plano-contas.configurar-valor-orcado');
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('permite a configuração quando o usuário tem a funcionalidade', async () => {
    vi.mocked(usuarioTemFuncionalidade).mockResolvedValue(true);
    const executeMock = vi.fn().mockResolvedValue({
      contaId: 'c7',
      exercicio: 2026,
      valor: { toString: () => '50000' },
      totaisAncestrais: [],
    });
    vi.mocked(getConfigurarValorOrcadoContaUseCase).mockReturnValue({ execute: executeMock } as never);

    const resultado = await configurarValorOrcadoConta('v1', 'c7', 2026, '50000.00');

    expect(resultado.sucesso).toBe(true);
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', contaId: 'c7', exercicio: 2026 }),
    );
  });

  it('retorna sessão inválida quando não há usuário autenticado no Clerk', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const resultado = await configurarValorOrcadoConta('v1', 'c7', 2026, '50000.00');

    expect(resultado).toEqual({ sucesso: false, mensagem: 'Sessão inválida.' });
    expect(usuarioTemFuncionalidade).not.toHaveBeenCalled();
  });
});
