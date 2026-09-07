// EP085 / UC02.10 / US-203 — cálculo da permissão EFETIVA de um usuário:
//
//   efetivas = ⋃(funcionalidades ativas dos perfis do usuário) − exceções do usuário
//
// CONTRATO CONGELADO NA FUNDAÇÃO. A US-203 troca APENAS o corpo, mantendo esta
// assinatura. Enquanto `excecoes` chega vazio, esta função é a identidade — o
// comportamento do menu e das checagens de permissão fica idêntico ao anterior
// (aditiva por ausência). Ver docs/US-203.

export type ParFuncionalidadePerfil = {
  perfilId: string;
  funcionalidadeId: string;
};

export type ExcecaoAcesso = ParFuncionalidadePerfil;

/**
 * Remove de `concedidas` todo par (perfilId, funcionalidadeId) presente em `excecoes`.
 * `T` preserva quaisquer campos extras que o chamador carregue junto (chave, nome, etc.).
 */
export function resolverPermissaoEfetiva<T extends ParFuncionalidadePerfil>(
  concedidas: readonly T[],
  excecoes: readonly ExcecaoAcesso[],
): T[] {
  if (excecoes.length === 0) return [...concedidas];

  const bloqueadas = new Set(excecoes.map((e) => `${e.perfilId}::${e.funcionalidadeId}`));
  return concedidas.filter((c) => !bloqueadas.has(`${c.perfilId}::${c.funcionalidadeId}`));
}
