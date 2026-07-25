import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';
import { MENSAGEM_ERRO_REDE, usuarioValido } from './support/env';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});

// CT-001 — UC01.01 + UC01.03
test('login com credenciais válidas redireciona para a tela principal com o menu carregado', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Login').fill(usuarioValido.login());
  await page.getByLabel('Senha').fill(usuarioValido.senha());
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
  // CA-01.03.02-04 — a tela principal só cumpre o UC01.03 se o menu do perfil for exibido,
  // não apenas se a sessão foi criada.
  await expect(page.getByRole('navigation')).toBeVisible();
});

// CT-002 — UC01.01
test('login com senha inválida mantém o usuário na tela de login com mensagem de erro', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Login').fill(usuarioValido.login());
  await page.getByLabel('Senha').fill('senha-incorreta-de-teste');
  await page.getByRole('button', { name: 'Entrar' }).click();

  const alerta = page.getByRole('alert');
  await expect(alerta).toBeVisible();
  // Uma falha de conectividade não pode se passar por "senha inválida" — são causas raiz distintas.
  await expect(alerta).not.toHaveText(MENSAGEM_ERRO_REDE);
  await expect(page).toHaveURL('/login');
});
