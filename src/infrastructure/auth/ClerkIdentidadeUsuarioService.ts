import { getClerkClient } from '@/infrastructure/auth/clerk';
import { ConviteIdentidadeError } from '@/domain/administracao/errors';
import type {
  IdentidadeUsuarioService,
  CriarIdentidadeInput,
} from '@/application/ports/IdentidadeUsuarioService';

/**
 * Implementação Clerk da porta IdentidadeUsuarioService (US-201 / US-204).
 *
 * `criarIdentidade`: `users.createUser({ skipPasswordRequirement: true })` — cria a
 * conta SEM enviar e-mail (não usa invitations nesta fase). A senha é definida
 * depois pelo usuário / resetada pelo Administrador (UC02.13).
 * `excluirIdentidade`: `users.deleteUser` — compensação quando o commit local falha.
 */
export class ClerkIdentidadeUsuarioService implements IdentidadeUsuarioService {
  async criarIdentidade(input: CriarIdentidadeInput): Promise<{ clerkUserId: string }> {
    const [firstName, ...resto] = input.nomeCompleto.trim().split(/\s+/);
    const lastName = resto.join(' ');

    try {
      const clerk = await getClerkClient();
      const criado = await clerk.users.createUser({
        emailAddress: [input.email],
        firstName: firstName || input.email,
        lastName: lastName || undefined,
        skipPasswordRequirement: true,
        publicMetadata: { tenantId: input.tenantId },
      });
      return { clerkUserId: criado.id };
    } catch (erro) {
      console.error('[ClerkIdentidadeUsuarioService.criarIdentidade]', erro);
      throw new ConviteIdentidadeError();
    }
  }

  async excluirIdentidade(clerkUserId: string): Promise<void> {
    const clerk = await getClerkClient();
    await clerk.users.deleteUser(clerkUserId);
  }
}
