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
 *
 * FUNDAÇÃO: stub. Corpo real na Frente E (feat/us-204-acesso-inicial).
 */
export class GerarAcessoInicialUsuarioUseCase {
  async execute(_input: GerarAcessoInicialInput): Promise<{ situacaoAcesso: SituacaoAcessoUsuario }> {
    throw new Error('GerarAcessoInicialUsuarioUseCase: não implementado (Frente E / US-204).');
  }
}
