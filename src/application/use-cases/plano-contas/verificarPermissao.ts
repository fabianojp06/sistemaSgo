import type { PrismaClient } from '@prisma/client';
import { resolverPermissaoEfetiva } from '@/domain/administracao/resolverPermissaoEfetiva';

/**
 * RNF_PLA_REQ_005 — checa se o usuário tem a funcionalidade ativa via algum perfil.
 *
 * EP085/US-203 — o resultado passa por `resolverPermissaoEfetiva`, que subtrai as
 * exceções por usuário (UsuarioPerfilExcecao). FUNDAÇÃO: `excecoes` = [] (passthrough
 * — comportamento idêntico ao anterior). A Frente D busca e aplica as exceções reais.
 */
export async function usuarioTemFuncionalidade(
  prisma: PrismaClient,
  tenantId: string,
  usuarioId: string,
  chave: string,
): Promise<boolean> {
  const pares = await prisma.perfilFuncionalidade.findMany({
    where: {
      funcionalidade: { chave, ativo: true, modulo: { ativo: true } },
      perfil: { tenantId, usuarios: { some: { tenantId, usuarioId } } },
    },
    select: { perfilId: true, funcionalidadeId: true },
  });

  return resolverPermissaoEfetiva(pares, []).length > 0;
}
