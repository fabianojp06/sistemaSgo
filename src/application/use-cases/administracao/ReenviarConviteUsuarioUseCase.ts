import type { PrismaClient, SituacaoAcessoUsuario } from '@prisma/client';
import type { ConviteIdentidadeService } from '@/application/ports/ConviteIdentidadeService';

export type ReenviarConviteInput = {
  tenantId: string;
  executorId: string;
  usuarioId: string;
};

/**
 * US-204 — reemite o convite de um usuário que ainda não fez o 1º acesso
 * (bloqueia se situacaoAcesso = ACESSO_ATIVO), volta situacaoAcesso a CONVITE_ENVIADO
 * e grava HistoricoOperacao (USUARIO_CONVITE_REENVIADO). Transação curta própria.
 *
 * FUNDAÇÃO: stub. Corpo real na Frente E (feat/us-204-acesso-inicial).
 */
export class ReenviarConviteUsuarioUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly convites: ConviteIdentidadeService,
  ) {}

  async execute(_input: ReenviarConviteInput): Promise<{ situacaoAcesso: SituacaoAcessoUsuario }> {
    throw new Error('ReenviarConviteUsuarioUseCase: não implementado (Frente E / US-204).');
  }
}
