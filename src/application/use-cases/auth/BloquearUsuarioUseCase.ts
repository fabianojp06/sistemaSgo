import type { PrismaClient } from '@prisma/client';
import { ehElegivelParaBloqueioAutomatico } from '@/domain/auth/regras-bloqueio';

type BloquearUsuarioInput = {
  tenantId: string;
  usuarioId: string;
  status: 'ATIVO' | 'INATIVO';
  quantidadeTentativas: number;
  ipEstacao?: string;
};

/**
 * UC01.05 — Bloquear Usuário [RN0024, RNF0011].
 * A gravação de `bloqueado = TRUE` é atômica (transação) e não depende do Clerk.
 * RN0032 — contas INATIVAS nunca são bloqueadas (bloqueio seria redundante).
 */
export class BloquearUsuarioUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: BloquearUsuarioInput): Promise<void> {
    if (!ehElegivelParaBloqueioAutomatico(input.status)) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: input.usuarioId },
        data: { bloqueado: true },
      }),
      this.prisma.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'BLOQUEIO_AUTOMATICO',
          descricao: `Conta bloqueada após ${input.quantidadeTentativas} tentativas consecutivas`,
          ipEstacao: input.ipEstacao,
          quantidadeTentativas: input.quantidadeTentativas,
        },
      }),
    ]);

    // RNF0012 — notificação ao Administrador é assíncrona e não pode impactar o tempo de resposta do login.
    void this.notificarAdministrador();
  }

  private async notificarAdministrador(): Promise<void> {
    // Implementação do canal de notificação (e-mail/Slack) fica a cargo da infraestrutura;
    // falhas aqui nunca devem propagar para o fluxo de autenticação [CA-01.05.12/13].
  }
}
