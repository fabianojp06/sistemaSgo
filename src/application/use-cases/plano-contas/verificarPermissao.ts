import type { PrismaClient } from '@prisma/client';

/** RNF_PLA_REQ_005 — checa se o usuário tem a funcionalidade ativa via algum perfil. */
export async function usuarioTemFuncionalidade(
  prisma: PrismaClient,
  tenantId: string,
  usuarioId: string,
  chave: string,
): Promise<boolean> {
  const permissao = await prisma.usuarioPerfil.findFirst({
    where: {
      tenantId,
      usuarioId,
      perfil: { permissoes: { some: { funcionalidade: { chave, ativo: true, modulo: { ativo: true } } } } },
    },
    select: { usuarioId: true },
  });

  return permissao !== null;
}
