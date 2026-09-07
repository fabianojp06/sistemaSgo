import { describe, expect, it, vi } from 'vitest';
import { AssociarPerfisUsuarioUseCase } from './AssociarPerfisUsuarioUseCase';
import { PerfilInvalidoError, UsuarioSemPerfilError } from '@/domain/administracao/errors';

type PerfilMock = { id: string; nome: string; tenantId: string; ativo: boolean };

function criarTx(perfis: PerfilMock[]) {
  const usuarioPerfilCreate = vi.fn(() => Promise.resolve({}));
  const historicoCreate = vi.fn(() => Promise.resolve({}));
  const tx = {
    perfil: {
      findMany: vi.fn(({ where }: { where: { id: { in: string[] }; tenantId: string; ativo: boolean } }) =>
        Promise.resolve(
          perfis
            .filter((p) => where.id.in.includes(p.id) && p.tenantId === where.tenantId && p.ativo === where.ativo)
            .map((p) => ({ id: p.id, nome: p.nome })),
        ),
      ),
    },
    usuarioPerfil: { create: usuarioPerfilCreate },
    historicoOperacao: { create: historicoCreate },
  };
  return { tx, usuarioPerfilCreate, historicoCreate };
}

const base = { tenantId: 't1', executorId: 'exec', usuarioId: 'u1', usuarioNome: 'João' };

describe('AssociarPerfisUsuarioUseCase [US-202]', () => {
  it('associa cada perfil ativo e grava 1 histórico por associação (RN0056/RN0083)', async () => {
    const { tx, usuarioPerfilCreate, historicoCreate } = criarTx([
      { id: 'p1', nome: 'Orçamentista', tenantId: 't1', ativo: true },
      { id: 'p2', nome: 'Consulta', tenantId: 't1', ativo: true },
    ]);
    await new AssociarPerfisUsuarioUseCase().execute({ ...base, tx: tx as never, perfis: ['p1', 'p2'] });
    expect(usuarioPerfilCreate).toHaveBeenCalledTimes(2);
    expect(historicoCreate).toHaveBeenCalledTimes(2);
  });

  it('bloqueia quando nenhum perfil é informado (RN0079)', async () => {
    const { tx } = criarTx([]);
    await expect(
      new AssociarPerfisUsuarioUseCase().execute({ ...base, tx: tx as never, perfis: [] }),
    ).rejects.toBeInstanceOf(UsuarioSemPerfilError);
  });

  it('bloqueia quando um perfil não existe / está inativo / é de outro tenant', async () => {
    const { tx } = criarTx([{ id: 'p1', nome: 'Orçamentista', tenantId: 't1', ativo: true }]);
    await expect(
      new AssociarPerfisUsuarioUseCase().execute({ ...base, tx: tx as never, perfis: ['p1', 'p-inativo'] }),
    ).rejects.toBeInstanceOf(PerfilInvalidoError);
  });
});
