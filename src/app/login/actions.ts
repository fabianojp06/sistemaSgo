'use server';

import { EfetuarLoginInputSchema } from '@/application/use-cases/auth/EfetuarLoginDto';
import { getAutenticarUsuarioUseCase } from '@/application/use-cases/auth/container';
import { AuthDomainError } from '@/domain/auth/errors';
import { getTenantId } from '@/infrastructure/tenant';

export type EfetuarLoginState = {
  erro?: string;
  signInToken?: string;
};

/**
 * UC01.01 — Efetuar Login (Server Action).
 * CA-01.01.04/05/06 — validação de obrigatoriedade ocorre antes de qualquer chamada ao backend.
 * O retorno traz um sign-in token de curta duração; a página troca esse token pela sessão
 * real via o SDK de frontend do Clerk ("strategy: ticket") e então redireciona [UC01.03].
 */
export async function efetuarLogin(_prevState: EfetuarLoginState, formData: FormData): Promise<EfetuarLoginState> {
  const parsed = EfetuarLoginInputSchema.safeParse({
    login: formData.get('login'),
    senha: formData.get('senha'),
  });

  if (!parsed.success) {
    return { erro: 'Login e/ou Senha são obrigatórios' };
  }

  const tenantId = await getTenantId();
  const autenticarUsuario = await getAutenticarUsuarioUseCase();

  try {
    const resultado = await autenticarUsuario.execute({
      tenantId,
      login: parsed.data.login,
      senha: parsed.data.senha,
    });
    return { signInToken: resultado.signInToken };
  } catch (error) {
    if (error instanceof AuthDomainError) {
      return { erro: error.message };
    }
    return { erro: 'Não foi possível estabelecer conexão com o servidor. Verifique sua rede e tente novamente.' };
  }
}
