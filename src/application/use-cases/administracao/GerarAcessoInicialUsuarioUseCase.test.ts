import { describe, expect, it, vi } from 'vitest';
import { GerarAcessoInicialUsuarioUseCase } from './GerarAcessoInicialUsuarioUseCase';

describe('GerarAcessoInicialUsuarioUseCase [US-204 fatia reduzida]', () => {
  it('define situacaoAcesso = CONVITE_PENDENTE e grava USUARIO_ACESSO_GERADO (RN0050)', async () => {
    const usuarioUpdate = vi.fn(() => Promise.resolve({}));
    const historicoCreate = vi.fn(() => Promise.resolve({}));
    const tx = { usuario: { update: usuarioUpdate }, historicoOperacao: { create: historicoCreate } };

    const resultado = await new GerarAcessoInicialUsuarioUseCase().execute({
      tx: tx as never,
      tenantId: 't1',
      executorId: 'exec',
      usuarioId: 'u1',
      usuarioNome: 'João',
    });

    expect(resultado).toEqual({ situacaoAcesso: 'CONVITE_PENDENTE' });
    expect(usuarioUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { situacaoAcesso: 'CONVITE_PENDENTE' },
    });
    expect(historicoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'USUARIO_ACESSO_GERADO' }) }),
    );
  });
});
