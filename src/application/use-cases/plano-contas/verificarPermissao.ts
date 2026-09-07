import type { PrismaClient } from '@prisma/client';
import { resolverPermissaoEfetiva } from '@/domain/administracao/resolverPermissaoEfetiva';

/**
 * RNF_PLA_REQ_005 — checa se o usuário tem a funcionalidade ativa via algum perfil.
 *
 * EP085/US-203 — o resultado passa por `resolverPermissaoEfetiva`, que subtrai as
 * exceções de acesso por usuário (UsuarioPerfilExcecao): se todos os pares
 * (perfil, funcionalidade) que concediam a `chave` estiverem excetuados para o
 * usuário, o acesso é negado.
 */
export async function usuarioTemFuncionalidade(
  prisma: PrismaClient,
  tenantId: string,
  usuarioId: string,
  chave: string,
): Promise<boolean> {
  const [pares, excecoes] = await Promise.all([
    prisma.perfilFuncionalidade.findMany({
      where: {
        funcionalidade: { chave, ativo: true, modulo: { ativo: true } },
        perfil: { tenantId, usuarios: { some: { tenantId, usuarioId } } },
      },
      select: { perfilId: true, funcionalidadeId: true },
    }),
    prisma.usuarioPerfilExcecao.findMany({
      where: { tenantId, usuarioId, funcionalidade: { chave } },
      select: { perfilId: true, funcionalidadeId: true },
    }),
  ]);

  return resolverPermissaoEfetiva(pares, excecoes).length > 0;
}
