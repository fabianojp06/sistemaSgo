import { describe, expect, it, vi } from 'vitest';
import { CredenciaisInvalidasError, SistemaEmManutencaoError, UsuarioBloqueadoError } from '@/domain/auth/errors';
import { AutenticarUsuarioUseCase } from './AutenticarUsuarioUseCase';

const USUARIO_BASE = {
  id: 'usuario-1',
  clerkUserId: 'clerk-1',
  email: 'fulano@example.com',
  status: 'ATIVO' as const,
  bloqueado: false,
  contadorFalhas: 0,
};

function criarPrismaMock(overrides: { usuario?: unknown; parametros?: unknown } = {}) {
  const usuario = 'usuario' in overrides ? overrides.usuario : USUARIO_BASE;
  return {
    usuario: {
      findFirst: vi.fn().mockResolvedValue(usuario),
      update: vi.fn().mockResolvedValue({}),
    },
    parametroSistema: {
      findUnique: vi.fn().mockResolvedValue(overrides.parametros ?? { flagManutencao: false, limiteTentativasLogin: 5 }),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
}

function criarClerkMock(overrides: { publicMetadata?: Record<string, unknown>; senhaValida?: boolean } = {}) {
  return {
    users: {
      getUser: vi.fn().mockResolvedValue({ publicMetadata: overrides.publicMetadata ?? {} }),
      verifyPassword: overrides.senhaValida === false
        ? vi.fn().mockRejectedValue(new Error('senha incorreta'))
        : vi.fn().mockResolvedValue({ verified: true }),
    },
    signInTokens: {
      createSignInToken: vi.fn().mockResolvedValue({ token: 'ticket-abc' }),
    },
  };
}

function criarBloquearUsuarioMock() {
  return { execute: vi.fn().mockResolvedValue(undefined) };
}

describe('AutenticarUsuarioUseCase [UC01.02]', () => {
  it('autentica com sucesso: zera contador, registra LOGIN_SUCESSO e retorna sign-in token', async () => {
    const prisma = criarPrismaMock();
    const clerk = criarClerkMock();
    const bloquearUsuario = criarBloquearUsuarioMock();
    const useCase = new AutenticarUsuarioUseCase(prisma as never, clerk as never, bloquearUsuario as never);

    const resultado = await useCase.execute({ tenantId: 't1', login: 'fulano@example.com', senha: 'Senha@123' });

    expect(resultado.signInToken).toBe('ticket-abc');
    expect(prisma.usuario.update).toHaveBeenCalledWith({ where: { id: 'usuario-1' }, data: { contadorFalhas: 0 } });
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'LOGIN_SUCESSO' }) }),
    );
  });

  it('login inexistente: registra LOGIN_FALHA com id_usuario nulo e retorna mensagem genérica [RN0015]', async () => {
    const prisma = criarPrismaMock({ usuario: null });
    const clerk = criarClerkMock();
    const bloquearUsuario = criarBloquearUsuarioMock();
    const useCase = new AutenticarUsuarioUseCase(prisma as never, clerk as never, bloquearUsuario as never);

    await expect(useCase.execute({ tenantId: 't1', login: 'inexistente', senha: 'x' })).rejects.toThrow(
      CredenciaisInvalidasError,
    );
    expect(clerk.users.getUser).not.toHaveBeenCalled();
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usuarioId: null }) }),
    );
  });

  it('conta bloqueada: rejeita sem chamar o Clerk para validar senha [RN0018, RN0012-rev]', async () => {
    const prisma = criarPrismaMock({ usuario: { ...USUARIO_BASE, bloqueado: true } });
    const clerk = criarClerkMock();
    const bloquearUsuario = criarBloquearUsuarioMock();
    const useCase = new AutenticarUsuarioUseCase(prisma as never, clerk as never, bloquearUsuario as never);

    await expect(useCase.execute({ tenantId: 't1', login: 'fulano@example.com', senha: 'x' })).rejects.toThrow(
      UsuarioBloqueadoError,
    );
    expect(clerk.users.verifyPassword).not.toHaveBeenCalled();
  });

  it('conta inativa: retorna mensagem genérica sem revelar o status [RN0015, RN0021]', async () => {
    const prisma = criarPrismaMock({ usuario: { ...USUARIO_BASE, status: 'INATIVO' } });
    const clerk = criarClerkMock();
    const bloquearUsuario = criarBloquearUsuarioMock();
    const useCase = new AutenticarUsuarioUseCase(prisma as never, clerk as never, bloquearUsuario as never);

    await expect(useCase.execute({ tenantId: 't1', login: 'fulano@example.com', senha: 'x' })).rejects.toThrow(
      CredenciaisInvalidasError,
    );
    expect(clerk.users.verifyPassword).not.toHaveBeenCalled();
  });

  it('sistema em manutenção e usuário sem role ADMIN: rejeita sem verificar senha [RN0023]', async () => {
    const prisma = criarPrismaMock({ parametros: { flagManutencao: true, limiteTentativasLogin: 5 } });
    const clerk = criarClerkMock({ publicMetadata: {} });
    const bloquearUsuario = criarBloquearUsuarioMock();
    const useCase = new AutenticarUsuarioUseCase(prisma as never, clerk as never, bloquearUsuario as never);

    await expect(useCase.execute({ tenantId: 't1', login: 'fulano@example.com', senha: 'x' })).rejects.toThrow(
      SistemaEmManutencaoError,
    );
    expect(clerk.users.verifyPassword).not.toHaveBeenCalled();
  });

  it('sistema em manutenção mas usuário é ADMIN: prossegue normalmente [RN0023]', async () => {
    const prisma = criarPrismaMock({ parametros: { flagManutencao: true, limiteTentativasLogin: 5 } });
    const clerk = criarClerkMock({ publicMetadata: { role: 'ADMIN' } });
    const bloquearUsuario = criarBloquearUsuarioMock();
    const useCase = new AutenticarUsuarioUseCase(prisma as never, clerk as never, bloquearUsuario as never);

    const resultado = await useCase.execute({ tenantId: 't1', login: 'fulano@example.com', senha: 'Senha@123' });
    expect(resultado.signInToken).toBe('ticket-abc');
  });

  it('senha incorreta: incrementa contador_falhas e retorna mensagem genérica [RN0026]', async () => {
    const prisma = criarPrismaMock({ usuario: { ...USUARIO_BASE, contadorFalhas: 2 } });
    const clerk = criarClerkMock({ senhaValida: false });
    const bloquearUsuario = criarBloquearUsuarioMock();
    const useCase = new AutenticarUsuarioUseCase(prisma as never, clerk as never, bloquearUsuario as never);

    await expect(useCase.execute({ tenantId: 't1', login: 'fulano@example.com', senha: 'errada' })).rejects.toThrow(
      CredenciaisInvalidasError,
    );
    expect(prisma.usuario.update).toHaveBeenCalledWith({ where: { id: 'usuario-1' }, data: { contadorFalhas: 3 } });
    expect(bloquearUsuario.execute).not.toHaveBeenCalled();
  });

  it('senha incorreta atingindo o limite: aciona BloquearUsuarioUseCase [RN0024, A4]', async () => {
    const prisma = criarPrismaMock({ usuario: { ...USUARIO_BASE, contadorFalhas: 4 } });
    const clerk = criarClerkMock({ senhaValida: false });
    const bloquearUsuario = criarBloquearUsuarioMock();
    const useCase = new AutenticarUsuarioUseCase(prisma as never, clerk as never, bloquearUsuario as never);

    await expect(useCase.execute({ tenantId: 't1', login: 'fulano@example.com', senha: 'errada' })).rejects.toThrow(
      CredenciaisInvalidasError,
    );
    expect(bloquearUsuario.execute).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 'usuario-1', quantidadeTentativas: 5 }),
    );
  });
});
