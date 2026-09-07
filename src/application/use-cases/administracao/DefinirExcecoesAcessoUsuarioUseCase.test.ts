import { describe, expect, it, vi } from 'vitest';
import { DefinirExcecoesAcessoUsuarioUseCase } from './DefinirExcecoesAcessoUsuarioUseCase';

type ParMock = { perfilId: string; funcionalidadeId: string; nome: string };

function criarTx(concedidas: ParMock[]) {
  const excecaoCreate = vi.fn(() => Promise.resolve({}));
  const historicoCreate = vi.fn(() => Promise.resolve({}));
  const tx = {
    perfilFuncionalidade: {
      findMany: vi.fn(() =>
        Promise.resolve(
          concedidas.map((c) => ({
            perfilId: c.perfilId,
            funcionalidadeId: c.funcionalidadeId,
            funcionalidade: { nome: c.nome },
          })),
        ),
      ),
    },
    usuarioPerfilExcecao: { create: excecaoCreate },
    historicoOperacao: { create: historicoCreate },
  };
  return { tx, excecaoCreate, historicoCreate };
}

const base = { tenantId: 't1', executorId: 'exec', usuarioId: 'u1', usuarioNome: 'João' };

describe('DefinirExcecoesAcessoUsuarioUseCase [US-203]', () => {
  it('grava a exceção quando o perfil está associado e concede a funcionalidade (REQ0080)', async () => {
    const { tx, excecaoCreate, historicoCreate } = criarTx([
      { perfilId: 'p1', funcionalidadeId: 'f1', nome: 'Emitir Relatório' },
    ]);
    await new DefinirExcecoesAcessoUsuarioUseCase().execute({
      ...base,
      tx: tx as never,
      perfisAssociados: ['p1'],
      excecoes: [{ perfilId: 'p1', funcionalidadeId: 'f1' }],
    });
    expect(excecaoCreate).toHaveBeenCalledTimes(1);
    expect(historicoCreate).toHaveBeenCalledTimes(1);
  });

  it('ignora exceção de perfil não associado ao usuário', async () => {
    const { tx, excecaoCreate } = criarTx([{ perfilId: 'p2', funcionalidadeId: 'f1', nome: 'X' }]);
    await new DefinirExcecoesAcessoUsuarioUseCase().execute({
      ...base,
      tx: tx as never,
      perfisAssociados: ['p1'],
      excecoes: [{ perfilId: 'p2', funcionalidadeId: 'f1' }],
    });
    expect(excecaoCreate).not.toHaveBeenCalled();
  });

  it('ignora exceção para funcionalidade que o perfil não concede (não adiciona acesso)', async () => {
    const { tx, excecaoCreate } = criarTx([]); // perfil não concede nada
    await new DefinirExcecoesAcessoUsuarioUseCase().execute({
      ...base,
      tx: tx as never,
      perfisAssociados: ['p1'],
      excecoes: [{ perfilId: 'p1', funcionalidadeId: 'f-que-o-perfil-nao-tem' }],
    });
    expect(excecaoCreate).not.toHaveBeenCalled();
  });

  it('não faz nada quando não há exceções', async () => {
    const { tx } = criarTx([]);
    await new DefinirExcecoesAcessoUsuarioUseCase().execute({
      ...base,
      tx: tx as never,
      perfisAssociados: ['p1'],
      excecoes: [],
    });
    expect(tx.perfilFuncionalidade.findMany).not.toHaveBeenCalled();
  });
});
