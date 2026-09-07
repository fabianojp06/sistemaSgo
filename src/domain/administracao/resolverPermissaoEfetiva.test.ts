import { describe, expect, it } from 'vitest';
import { resolverPermissaoEfetiva } from './resolverPermissaoEfetiva';

const concedidas = [
  { perfilId: 'p1', funcionalidadeId: 'f1', chave: 'a.listar' },
  { perfilId: 'p1', funcionalidadeId: 'f2', chave: 'a.criar' },
  { perfilId: 'p2', funcionalidadeId: 'f1', chave: 'a.listar' },
];

describe('resolverPermissaoEfetiva', () => {
  it('sem exceções é a identidade (passthroughda fundação)', () => {
    expect(resolverPermissaoEfetiva(concedidas, [])).toEqual(concedidas);
  });

  it('remove apenas o par (perfil, funcionalidade) excetuado', () => {
    const efetivas = resolverPermissaoEfetiva(concedidas, [{ perfilId: 'p1', funcionalidadeId: 'f2' }]);
    expect(efetivas).toEqual([
      { perfilId: 'p1', funcionalidadeId: 'f1', chave: 'a.listar' },
      { perfilId: 'p2', funcionalidadeId: 'f1', chave: 'a.listar' },
    ]);
  });

  it('a exceção é escopada ao perfil — não afeta o mesmo funcionalidadeId em outro perfil', () => {
    const efetivas = resolverPermissaoEfetiva(concedidas, [{ perfilId: 'p1', funcionalidadeId: 'f1' }]);
    expect(efetivas).toContainEqual({ perfilId: 'p2', funcionalidadeId: 'f1', chave: 'a.listar' });
    expect(efetivas).not.toContainEqual({ perfilId: 'p1', funcionalidadeId: 'f1', chave: 'a.listar' });
  });

  it('não muta o array de entrada', () => {
    const copia = [...concedidas];
    resolverPermissaoEfetiva(concedidas, [{ perfilId: 'p1', funcionalidadeId: 'f1' }]);
    expect(concedidas).toEqual(copia);
  });
});
