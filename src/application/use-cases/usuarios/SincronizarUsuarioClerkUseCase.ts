import type { PrismaClient } from '@prisma/client';

type SincronizarUsuarioClerkInput = {
  clerkUserId: string;
  tenantId: string;
  nomeCompleto: string;
  email: string;
  // EP085/UC02.12 — `login` é obrigatório e único no banco próprio. Na criação via
  // webhook usamos o `username` do Clerk (ou a parte local do e-mail como fallback);
  // em updates o login nunca muda (RN0066).
  login: string;
};

/**
 * Sincroniza Usuario (banco próprio) a partir dos eventos `user.created`/`user.updated`
 * do Clerk [RN_AUTH_Clerk_BancoProprio.md — "o Clerk é a fonte de verdade para
 * autenticação; nome/email são mantidos no banco próprio via webhook"].
 * Nunca grava senha/hash aqui — este use case não lida com credenciais.
 */
export class SincronizarUsuarioClerkUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: SincronizarUsuarioClerkInput): Promise<void> {
    await this.prisma.usuario.upsert({
      where: { clerkUserId: input.clerkUserId },
      update: { nomeCompleto: input.nomeCompleto, email: input.email },
      create: {
        clerkUserId: input.clerkUserId,
        tenantId: input.tenantId,
        nomeCompleto: input.nomeCompleto,
        email: input.email,
        login: input.login,
      },
    });
  }
}
