import type { PrismaClient, SituacaoAcessoUsuario } from '@prisma/client';
import type { IdentidadeUsuarioService } from '@/application/ports/IdentidadeUsuarioService';

export type ReenviarConviteInput = {
  tenantId: string;
  executorId: string;
  usuarioId: string;
};

/**
 * US-204 — ADIADO. Depende do envio de e-mail/convite, que não será feito nesta
 * fase (decisão 2026-09-07). Mantido como stub para o contrato não quebrar; a
 * frente E só implementa quando o disparo de e-mail entrar em escopo.
 */
export class ReenviarConviteUsuarioUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly identidade: IdentidadeUsuarioService,
  ) {}

  async execute(_input: ReenviarConviteInput): Promise<{ situacaoAcesso: SituacaoAcessoUsuario }> {
    throw new Error('ReenviarConviteUsuarioUseCase: adiado — envio de e-mail fora de escopo nesta fase.');
  }
}
