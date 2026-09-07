// EP085 / UC02.12 / UC02.18 — porta para o provedor de identidade (Clerk).
// Isola a decisão "invitations.createInvitation" vs "users.createUser + reset"
// (a confirmar no plano free do Clerk — ver docs/US-204 e docs/PLANO).
//
// CONTRATO CONGELADO NA FUNDAÇÃO. Impl real: infrastructure/auth/ClerkConviteIdentidadeService.ts (US-201/US-204).

export type CriarConviteInput = {
  tenantId: string;
  email: string;
  nomeCompleto: string;
  login: string;
};

export type CriarConviteResultado = {
  clerkUserId: string;
  conviteId: string;
};

export interface ConviteIdentidadeService {
  /** Cria a identidade e dispara o e-mail de definição de senha. */
  criarConvite(input: CriarConviteInput): Promise<CriarConviteResultado>;

  /** Compensação da US-201: desfaz o convite quando o commit local falha. */
  revogarConvite(conviteId: string): Promise<void>;

  /** US-204: reemite o convite e invalida o anterior. */
  reenviarConvite(clerkUserId: string): Promise<{ conviteId: string }>;
}
