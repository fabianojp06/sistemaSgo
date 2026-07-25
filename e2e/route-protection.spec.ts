import { expect, test } from '@playwright/test';

// CT-007 — segurança transversal, valida src/middleware.ts
test('acesso direto à tela principal sem sessão redireciona para /login sem expor conteúdo', async ({ browser }) => {
  const context = await browser.newContext(); // sem storageState — navegador "limpo", sem sessão
  const page = await context.newPage();

  await page.goto('/');

  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Acessar o SGO' })).toBeVisible();

  await context.close();
});
