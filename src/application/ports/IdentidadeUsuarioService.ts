// EP085 / UC02.12 — porta para o provedor de identidade (Clerk).
//
// DECISÃO (2026-09-07): mantém-se o Clerk como provedor de identidade, mas o
// ENVIO de e-mail / convite fica ADIADO. No cadastro o Administrador cria a
// identidade no Clerk (o usuário passa a conseguir autenticar depois), sem
// disparo de e-mail — a senha inicial é comunicada/resetada manualmente
// (fora do escopo do UC02.12; ver UC02.13). Ver docs/US-201 e docs/US-204.
//
// CONTRATO CONGELADO. Impl real: infrastructure/auth/ClerkIdentidadeUsuarioService.ts (Frente B / US-201).

export type CriarIdentidadeInput = {
  tenantId: string;
  email: string;
  nomeCompleto: string;
  login: string;
};

export interface IdentidadeUsuarioService {
  /** Cria a identidade no provedor SEM enviar e-mail. Retorna o id externo. */
  criarIdentidade(input: CriarIdentidadeInput): Promise<{ clerkUserId: string }>;

  /** Compensação da US-201: remove a identidade quando o commit local falha. */
  excluirIdentidade(clerkUserId: string): Promise<void>;
}
