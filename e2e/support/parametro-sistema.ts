import { prisma } from '@/infrastructure/db/prisma';
import { usuarioParaBloqueio } from './env';

/**
 * Espelha o fallback de AutenticarUsuarioUseCase (parametros?.limiteTentativasLogin ?? 5) —
 * o teste de bloqueio precisa iterar o número real configurado para o tenant, não um valor
 * fixo, senão "passa" testando um caminho diferente do pretendido quando o tenant de teste
 * tiver outro limite configurado.
 */
export async function obterLimiteTentativasLogin(): Promise<number> {
  const parametros = await prisma.parametroSistema.findUnique({
    where: { tenantId: usuarioParaBloqueio.tenantId() },
    select: { limiteTentativasLogin: true },
  });

  return parametros?.limiteTentativasLogin ?? 5;
}
