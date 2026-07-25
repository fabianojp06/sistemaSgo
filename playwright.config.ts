import { defineConfig, devices } from '@playwright/test';

/**
 * Config E2E do módulo de autenticação (UC01). `baseURL` aponta para o `next dev`
 * levantado automaticamente pelo `webServer` — não requer servidor rodando à mão.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/support/global-setup.ts',
  fullyParallel: false, // CT-004 bloqueia um usuário compartilhado; evita corrida entre specs.
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
