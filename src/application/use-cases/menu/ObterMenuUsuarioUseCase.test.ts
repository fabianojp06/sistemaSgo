import { describe, expect, it, vi } from 'vitest';
import { ObterMenuUsuarioUseCase } from './ObterMenuUsuarioUseCase';

function criarPrismaMock(usuarioPerfilFindMany: unknown[]) {
  return {
    usuarioPerfil: { findMany: vi.fn().mockResolvedValue(usuarioPerfilFindMany) },
  };
}

describe('ObterMenuUsuarioUseCase [UC01.03]', () => {
  it('agrupa funcionalidades por módulo, sem duplicar entre perfis [CA-01.03.02/04]', async () => {
    const prisma = criarPrismaMock([
      {
        perfil: {
          permissoes: [
            { funcionalidade: { chave: 'empenhos.criar', nome: 'Criar Empenho', modulo: { chave: 'empenhos', nome: 'Empenhos' } } },
          ],
        },
      },
      {
        perfil: {
          permissoes: [
            { funcionalidade: { chave: 'empenhos.criar', nome: 'Criar Empenho', modulo: { chave: 'empenhos', nome: 'Empenhos' } } },
            { funcionalidade: { chave: 'dotacoes.consultar', nome: 'Consultar Dotação', modulo: { chave: 'dotacoes', nome: 'Dotações' } } },
          ],
        },
      },
    ]);
    const useCase = new ObterMenuUsuarioUseCase(prisma as never);

    const menu = await useCase.execute('tenant-1', 'usuario-1');

    expect(prisma.usuarioPerfil.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1', usuarioId: 'usuario-1' } }),
    );
    expect(menu).toEqual([
      { chave: 'empenhos', nome: 'Empenhos', funcionalidades: [{ chave: 'empenhos.criar', nome: 'Criar Empenho' }] },
      { chave: 'dotacoes', nome: 'Dotações', funcionalidades: [{ chave: 'dotacoes.consultar', nome: 'Consultar Dotação' }] },
    ]);
  });

  it('retorna lista vazia quando o usuário não tem perfil/permissão [E4, CA-01.03.18]', async () => {
    const prisma = criarPrismaMock([]);
    const useCase = new ObterMenuUsuarioUseCase(prisma as never);

    const menu = await useCase.execute('tenant-1', 'usuario-1');

    expect(menu).toEqual([]);
  });
});
