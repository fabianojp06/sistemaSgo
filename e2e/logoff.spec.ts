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

// CT-009 — UC01.04 — E1 (CA-01.04.09/10): Server Action stale/falha de rede
test('logoff prossegue no cliente mesmo quando a Server Action falha (bundle desatualizado após deploy)', async ({
  page,
}) => {
  // Simula um Server Action rejeitado por deploy divergente ("Failed to find Server
  // Action ID..."): a chamada RSC do POST em '/' (Next-Action) é abortada como se a
  // rota não existisse mais no servidor atual.
  await page.route('**/', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.headers()['next-action']) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await page.getByRole('button', { name: 'Sair' }).click();
  await page.getByRole('button', { name: 'Sim' }).click();

  // Mesmo com a Server Action falhando, o cliente deve concluir o signOut do Clerk
  // e redirecionar para /login (via navegação completa, não client-side routing).
  await expect(page).toHaveURL('/login', { timeout: 10_000 });

  await page.unroute('**/');
  await page.goto('/');
  await expect(page).toHaveURL('/login');
});
