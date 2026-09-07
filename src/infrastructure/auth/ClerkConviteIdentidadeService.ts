import type {
  ConviteIdentidadeService,
  CriarConviteInput,
  CriarConviteResultado,
} from '@/application/ports/ConviteIdentidadeService';

/**
 * Implementação Clerk da porta ConviteIdentidadeService.
 * FUNDAÇÃO: stub. Corpo real nas Frentes B/E (US-201/US-204) — decidir entre
 * `clerkClient.invitations.createInvitation` e `users.createUser` + reset (ver docs/US-204).
 */
export class ClerkConviteIdentidadeService implements ConviteIdentidadeService {
  async criarConvite(_input: CriarConviteInput): Promise<CriarConviteResultado> {
    throw new Error('ClerkConviteIdentidadeService.criarConvite: não implementado (Frente B / US-201).');
  }

  async revogarConvite(_conviteId: string): Promise<void> {
    throw new Error('ClerkConviteIdentidadeService.revogarConvite: não implementado (Frente B / US-201).');
  }

  async reenviarConvite(_clerkUserId: string): Promise<{ conviteId: string }> {
    throw new Error('ClerkConviteIdentidadeService.reenviarConvite: não implementado (Frente E / US-204).');
  }
}
