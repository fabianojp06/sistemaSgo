import type { ExcecaoAcessoInput, TxCliente } from './dtos';

export type DefinirExcecoesInput = {
  tx: TxCliente;
  tenantId: string;
  executorId: string;
  usuarioId: string;
  usuarioNome: string;
  /** perfis efetivamente associados ao usuário — a exceção só é válida se o par pertence a um deles */
  perfisAssociados: string[];
  excecoes: ExcecaoAcessoInput[];
};

/**
 * US-203 — grava as exceções de acesso (UsuarioPerfilExcecao) na transação de cadastro.
 * A exceção só REMOVE acesso; pares que o perfil não concede são ignorados (REQ0080/REQ0081).
 * Um HistoricoOperacao (USUARIO_PERFIL_EXCECAO_DEFINIDA) por exceção.
 *
 * FUNDAÇÃO: stub. Corpo real na Frente D (feat/us-203-excecoes-acesso).
 */
export class DefinirExcecoesAcessoUsuarioUseCase {
  async execute(_input: DefinirExcecoesInput): Promise<void> {
    throw new Error('DefinirExcecoesAcessoUsuarioUseCase: não implementado (Frente D / US-203).');
  }
}
