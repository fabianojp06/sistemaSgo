import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';
import { usuarioValido } from './support/env';

test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto('/login');
  await page.getByLabel('Login').fill(usuarioValido.login());
  await page.getByLabel('Senha').fill(usuarioValido.senha());
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/');
});

// CT-006 — UC01.04
test('logoff encerra a sessão e bloqueia acesso subsequente à tela principal', async ({ page }) => {
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.getByRole('button', { name: 'Sim' }).click();

  await expect(page).toHaveURL('/login');

  await page.goto('/');
  await expect(page).toHaveURL('/login');
});
