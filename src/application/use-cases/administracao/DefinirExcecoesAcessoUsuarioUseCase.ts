import type { ExcecaoAcessoInput, TxCliente } from './dtos';

export type DefinirExcecoesInput = {
  tx: TxCliente;
  tenantId: string;
  executorId: string;
  usuarioId: string;
  usuarioNome: string;
  /** perfis efetivamente associados ao usuário — a exceção só vale se o par pertence a um deles */
  perfisAssociados: string[];
  excecoes: ExcecaoAcessoInput[];
};

/**
 * US-203 / UC02.10 — grava as exceções de acesso (UsuarioPerfilExcecao) na transação
 * de cadastro. A exceção só REMOVE acesso: pares cujo perfil não está associado ao
 * usuário, ou cujo perfil não concede a funcionalidade, são ignorados [REQ0080].
 * Um HistoricoOperacao (USUARIO_PERFIL_EXCECAO_DEFINIDA) por exceção efetivamente gravada.
 */
export class DefinirExcecoesAcessoUsuarioUseCase {
  async execute(input: DefinirExcecoesInput): Promise<void> {
    if (input.excecoes.length === 0) return;

    const perfisAssociados = new Set(input.perfisAssociados);
    const candidatas = input.excecoes.filter((e) => perfisAssociados.has(e.perfilId));
    if (candidatas.length === 0) return;

    // Só é exceção válida se o perfil realmente concede aquela funcionalidade (não adiciona acesso).
    const concedidas = await input.tx.perfilFuncionalidade.findMany({
      where: {
        perfilId: { in: [...new Set(candidatas.map((e) => e.perfilId))] },
        funcionalidadeId: { in: [...new Set(candidatas.map((e) => e.funcionalidadeId))] },
      },
      select: { perfilId: true, funcionalidadeId: true, funcionalidade: { select: { nome: true } } },
    });
    const nomePorPar = new Map(
      concedidas.map((c) => [`${c.perfilId}::${c.funcionalidadeId}`, c.funcionalidade.nome]),
    );

    const gravadas = new Set<string>();
    for (const excecao of candidatas) {
      const chave = `${excecao.perfilId}::${excecao.funcionalidadeId}`;
      if (gravadas.has(chave) || !nomePorPar.has(chave)) continue;
      gravadas.add(chave);

      await input.tx.usuarioPerfilExcecao.create({
        data: {
          usuarioId: input.usuarioId,
          perfilId: excecao.perfilId,
          funcionalidadeId: excecao.funcionalidadeId,
          tenantId: input.tenantId,
        },
      });
      await input.tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.executorId,
          tipoOperacao: 'USUARIO_PERFIL_EXCECAO_DEFINIDA',
          descricao: `Acesso à funcionalidade "${nomePorPar.get(chave)}" retirado do usuário "${input.usuarioNome}"`,
          dadosSerializados: {
            usuarioId: input.usuarioId,
            perfilId: excecao.perfilId,
            funcionalidadeId: excecao.funcionalidadeId,
          },
        },
      });
    }
  }
}
