import { prisma } from '@/infrastructure/db/prisma';
import { usuarioParaBloqueio } from './env';

/**
 * Garante estado limpo do usuário de lockout antes de cada execução de CT-004 —
 * a suíte não depende de ordem/execuções anteriores para ser determinística.
 */
export async function resetarUsuarioDeBloqueio(): Promise<void> {
  await prisma.usuario.updateMany({
    where: { tenantId: usuarioParaBloqueio.tenantId(), email: { equals: usuarioParaBloqueio.login(), mode: 'insensitive' } },
    data: { bloqueado: false, contadorFalhas: 0 },
  });
}
