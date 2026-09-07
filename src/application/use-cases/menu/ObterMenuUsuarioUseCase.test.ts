import { describe, expect, it, vi } from 'vitest';
import { ObterMenuUsuarioUseCase } from './ObterMenuUsuarioUseCase';

function criarPrismaMock(usuarioPerfilFindMany: unknown[], excecoes: unknown[] = []) {
  return {
    usuarioPerfil: { findMany: vi.fn().mockResolvedValue(usuarioPerfilFindMany) },
    usuarioPerfilExcecao: { findMany: vi.fn().mockResolvedValue(excecoes) },
  };
}

describe('ObterMenuUsuarioUseCase [UC01.03]', () => {
  it('agrupa funcionalidades por módulo, sem duplicar entre perfis [CA-01.03.02/04]', async () => {
    const prisma = criarPrismaMock([
      {
        perfilId: 'perfil-a',
        perfil: {
          permissoes: [
            { funcionalidade: { id: 'f-emp', chave: 'empenhos.criar', nome: 'Criar Empenho', tipo: 'NAVEGAVEL', modulo: { chave: 'empenhos', nome: 'Empenhos' } } },
          ],
        },
      },
      {
        perfilId: 'perfil-b',
        perfil: {
          permissoes: [
            { funcionalidade: { id: 'f-emp', chave: 'empenhos.criar', nome: 'Criar Empenho', tipo: 'NAVEGAVEL', modulo: { chave: 'empenhos', nome: 'Empenhos' } } },
            { funcionalidade: { id: 'f-dot', chave: 'dotacoes.consultar', nome: 'Consultar Dotação', tipo: 'CONTEXTUAL', modulo: { chave: 'dotacoes', nome: 'Dotações' } } },
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
      { chave: 'empenhos', nome: 'Empenhos', funcionalidades: [{ chave: 'empenhos.criar', nome: 'Criar Empenho', tipo: 'NAVEGAVEL' }] },
      { chave: 'dotacoes', nome: 'Dotações', funcionalidades: [{ chave: 'dotacoes.consultar', nome: 'Consultar Dotação', tipo: 'CONTEXTUAL' }] },
    ]);
  });

  it('retorna lista vazia quando o usuário não tem perfil/permissão [E4, CA-01.03.18]', async () => {
    const prisma = criarPrismaMock([]);
    const useCase = new ObterMenuUsuarioUseCase(prisma as never);

    const menu = await useCase.execute('tenant-1', 'usuario-1');

    expect(menu).toEqual([]);
  });

  it('EP085/US-203 — remove do menu a funcionalidade excetuada para o usuário', async () => {
    const prisma = criarPrismaMock(
      [
        {
          perfilId: 'perfil-a',
          perfil: {
            permissoes: [
              { funcionalidade: { id: 'f-lanc', chave: 'despesa.lancar', nome: 'Lançar Despesa', tipo: 'NAVEGAVEL', modulo: { chave: 'orcamento', nome: 'Orçamento' } } },
              { funcionalidade: { id: 'f-rel', chave: 'relatorio.emitir', nome: 'Emitir Relatório', tipo: 'NAVEGAVEL', modulo: { chave: 'orcamento', nome: 'Orçamento' } } },
            ],
          },
        },
      ],
      [{ perfilId: 'perfil-a', funcionalidadeId: 'f-rel' }],
    );
    const useCase = new ObterMenuUsuarioUseCase(prisma as never);

    const menu = await useCase.execute('tenant-1', 'usuario-1');

    expect(menu).toEqual([
      { chave: 'orcamento', nome: 'Orçamento', funcionalidades: [{ chave: 'despesa.lancar', nome: 'Lançar Despesa', tipo: 'NAVEGAVEL' }] },
    ]);
  });
});
