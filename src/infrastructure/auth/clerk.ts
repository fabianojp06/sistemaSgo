import { clerkClient } from '@clerk/nextjs/server';

export type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;

export async function getClerkClient(): Promise<ClerkClient> {
  return clerkClient();
}

/** RN-NOVO-02 — papel de Administrador vem dos metadados públicos do Clerk, não do nosso banco. */
export function ehAdministrador(user: { publicMetadata?: Record<string, unknown> }): boolean {
  return user.publicMetadata?.role === 'ADMIN';
}
