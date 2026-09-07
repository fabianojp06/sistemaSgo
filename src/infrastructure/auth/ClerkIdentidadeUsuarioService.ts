import type {
  IdentidadeUsuarioService,
  CriarIdentidadeInput,
} from '@/application/ports/IdentidadeUsuarioService';

/**
 * Implementação Clerk da porta IdentidadeUsuarioService.
 *
 * FUNDAÇÃO: stub. Corpo real na Frente B (feat/us-201-criar-usuario):
 *   - criarIdentidade: `clerkClient.users.createUser({ ..., skipPasswordRequirement: true })`
 *     (NÃO usar invitations — sem e-mail nesta fase). Espelhar `login` como `username`.
 *   - excluirIdentidade: `clerkClient.users.deleteUser(clerkUserId)` (compensação).
 */
export class ClerkIdentidadeUsuarioService implements IdentidadeUsuarioService {
  async criarIdentidade(_input: CriarIdentidadeInput): Promise<{ clerkUserId: string }> {
    throw new Error('ClerkIdentidadeUsuarioService.criarIdentidade: não implementado (Frente B / US-201).');
  }

  async excluirIdentidade(_clerkUserId: string): Promise<void> {
    throw new Error('ClerkIdentidadeUsuarioService.excluirIdentidade: não implementado (Frente B / US-201).');
  }
}
