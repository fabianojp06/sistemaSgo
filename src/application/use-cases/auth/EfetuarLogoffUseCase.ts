import type { PrismaClient } from '@prisma/client';
import type { ClerkClient } from '@/infrastructure/auth/clerk';

type EfetuarLogoffInput = {
  tenantId: string;
  usuarioId: string;
  clerkSessionId: string;
};

/**
 * UC01.04 — Efetuar Logoff [RN0028–RN0031].
 * Ordem obrigatória [CA-01.04.02]: (1) revogar a sessão no Clerk, (2) registrar LOGOFF
 * no histórico. A limpeza do token no cliente [passo 2 do CA] é responsabilidade do
 * chamador (client-side, via signOut do Clerk) — este use case cobre apenas o servidor.
 * E1 [CA-01.04.09/10] — se o Clerk não responder, o logoff no cliente deve prosseguir
 * mesmo assim; o token remanescente no servidor expira pelo TTL configurado.
 * E2 [CA-01.04.11/12] — falha ao registrar auditoria NUNCA reverte a sessão já revogada.
 * Por isso nenhuma etapa deste método lança exceção — o chamador sempre prossegue
 * para invalidar o token no cliente e redirecionar, independente do resultado aqui.
 */
export class EfetuarLogoffUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clerk: ClerkClient,
  ) {}

  async execute(input: EfetuarLogoffInput): Promise<void> {
    try {
      await this.clerk.sessions.revokeSession(input.clerkSessionId);
    } catch {
      // E1 — falha de rede/indisponibilidade do Clerk; token remanescente expira por TTL.
    }

    try {
      await this.prisma.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          clerkSessionId: input.clerkSessionId,
          tipoOperacao: 'LOGOFF',
          descricao: 'Logoff efetuado pelo usuário',
        },
      });
    } catch {
      // E2 — falha de auditoria não desfaz o logoff; erro deve ser revisado pelo Administrador
      // fora do fluxo síncrono de resposta ao usuário.
    }
  }
}
