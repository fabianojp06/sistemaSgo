import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';
import { MENSAGEM_ERRO_REDE, usuarioParaBloqueio } from './support/env';
import { obterLimiteTentativasLogin } from './support/parametro-sistema';
import { resetarUsuarioDeBloqueio } from './support/reset-lockout-user';

test.beforeEach(async ({ page }) => {
  await resetarUsuarioDeBloqueio();
  await setupClerkTestingToken({ page });
});

test.afterEach(async () => {
  await resetarUsuarioDeBloqueio();
});

// CT-004 — UC01.02 + UC01.05.
test('bloqueia o usuário após esgotar as tentativas e rejeita mesmo com a senha correta depois', async ({ page }) => {
  // Lê o limite real configurado para o tenant de teste (mesmo fallback de 5 usado em produção
  // por AutenticarUsuarioUseCase) em vez de hardcodar — um tenant com limite diferente não pode
  // fazer este teste "passar" testando o caminho errado (bloqueio prematuro/tardio).
  const limiteTentativas = await obterLimiteTentativasLogin();

  for (let tentativa = 1; tentativa <= limiteTentativas; tentativa += 1) {
    await page.goto('/login');
    await page.getByLabel('Login').fill(usuarioParaBloqueio.login());
    await page.getByLabel('Senha').fill('senha-incorreta-de-teste');
    await page.getByRole('button', { name: 'Entrar' }).click();
    const alerta = page.getByRole('alert');
    await expect(alerta).toBeVisible();
    await expect(alerta).not.toHaveText(MENSAGEM_ERRO_REDE);
  }

  await page.goto('/login');
  await page.getByLabel('Login').fill(usuarioParaBloqueio.login());
  await page.getByLabel('Senha').fill(usuarioParaBloqueio.senha());
  await page.getByRole('button', { name: 'Entrar' }).click();

  const alertaFinal = page.getByRole('alert');
  await expect(alertaFinal).toBeVisible();
  await expect(alertaFinal).not.toHaveText(MENSAGEM_ERRO_REDE);
  await expect(page).toHaveURL('/login');
});
