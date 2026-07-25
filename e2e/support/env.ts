/** Mensagem genérica de falha de rede/servidor em src/app/login/actions.ts (efetuarLogin). Um teste
 * negativo (senha inválida, bloqueio) nunca deve "passar" só porque esse alerta genérico apareceu —
 * isso mascararia uma falha de infraestrutura como se fosse o comportamento de negócio esperado. */
export const MENSAGEM_ERRO_REDE = 'Não foi possível estabelecer conexão com o servidor. Verifique sua rede e tente novamente.';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não definida. Configure os usuários de teste do Clerk antes de rodar a suíte E2E (ver e2e/README.md).`,
    );
  }
  return value;
}

/** Usuário "feliz" — nunca deve ser usado em cenários que provocam bloqueio (CT-004). */
export const usuarioValido = {
  login: () => required('E2E_CLERK_USER_USERNAME'),
  senha: () => required('E2E_CLERK_USER_PASSWORD'),
};

/** Usuário dedicado e descartável para os cenários de tentativa inválida/bloqueio. */
export const usuarioParaBloqueio = {
  login: () => required('E2E_CLERK_LOCKOUT_USER_USERNAME'),
  senha: () => required('E2E_CLERK_LOCKOUT_USER_PASSWORD'),
  tenantId: () => required('E2E_TENANT_ID'),
};
