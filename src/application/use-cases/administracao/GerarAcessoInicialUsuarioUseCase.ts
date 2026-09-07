import type { SituacaoAcessoUsuario } from '@prisma/client';
import type { TxCliente } from './dtos';

export type GerarAcessoInicialInput = {
  tx: TxCliente;
  tenantId: string;
  executorId: string;
  usuarioId: string;
  usuarioNome: string;
};

/**
 * US-204 (fatia reduzida — envio de e-mail ADIADO) — dentro da transação de
 * cadastro, define `Usuario.situacaoAcesso = CONVITE_PENDENTE` (identidade criada,
 * senha inicial ainda não comunicada) e grava HistoricoOperacao
 * (USUARIO_ACESSO_GERADO) — RN0050. Nenhuma senha é gerada/logada pelo SGO (RN0059).
 * A promoção a ACESSO_ATIVO acontece no 1º login, via webhook do Clerk.
 */
export class GerarAcessoInicialUsuarioUseCase {
  async execute(input: GerarAcessoInicialInput): Promise<{ situacaoAcesso: SituacaoAcessoUsuario }> {
    const situacaoAcesso: SituacaoAcessoUsuario = 'CONVITE_PENDENTE';

    await input.tx.usuario.update({
      where: { id: input.usuarioId },
      data: { situacaoAcesso },
    });
    await input.tx.historicoOperacao.create({
      data: {
        tenantId: input.tenantId,
        usuarioId: input.executorId,
        tipoOperacao: 'USUARIO_ACESSO_GERADO',
        descricao: `Gerou o acesso inicial do usuário "${input.usuarioNome}"`,
        dadosSerializados: { usuarioId: input.usuarioId, situacaoAcesso },
      },
    });

    return { situacaoAcesso };
  }
}
