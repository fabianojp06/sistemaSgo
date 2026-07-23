# Padrões de Automação de Testes — SGO 2.0

Consulte este arquivo no **Automation Mode** — ao escrever código de teste automatizado.

Stack de testes do projeto:
- **Vitest** — testes unitários e de integração
- **Playwright** — testes E2E
- **Prisma** — acesso ao banco em testes de integração

---

## Vitest — Testes unitários

### Estrutura padrão de arquivo

```typescript
// src/modules/empenho/__tests__/calcular-saldo.test.ts
import { describe, it, expect } from 'vitest'
import { calcularSaldoDisponivel } from '../calcular-saldo'

describe('calcularSaldoDisponivel', () => {
  it('retorna saldo correto após empenho parcial', () => {
    const resultado = calcularSaldoDisponivel({
      dotacaoInicial: new Decimal('10000.00'),
      totalEmpenhado: new Decimal('3000.00'),
    })
    expect(resultado.toString()).toBe('7000.00')
  })

  it('retorna zero quando dotação está totalmente empenhada', () => {
    const resultado = calcularSaldoDisponivel({
      dotacaoInicial: new Decimal('5000.00'),
      totalEmpenhado: new Decimal('5000.00'),
    })
    expect(resultado.toString()).toBe('0.00')
  })

  it('lança erro quando totalEmpenhado excede dotacaoInicial', () => {
    expect(() => calcularSaldoDisponivel({
      dotacaoInicial: new Decimal('1000.00'),
      totalEmpenhado: new Decimal('1500.00'),
    })).toThrow('Saldo insuficiente')
  })
})
```

### Regras para testes unitários

- Sem I/O: sem banco, sem rede, sem filesystem
- Um `describe` por módulo/função; um `it` por comportamento
- Nome do `it` descreve o comportamento, não o método: `'retorna erro quando saldo é insuficiente'`, não `'testa calcularSaldo'`
- Use `Decimal` (não `number` ou `string`) para valores monetários — igual ao código de produção
- Cubra: caminho feliz + pelo menos 2 cenários negativos + 1 borda por função crítica

---

## Vitest — Testes de integração (Server Actions + Banco)

### Setup de ambiente de teste

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/setup/global-setup.ts',
    setupFiles: ['./tests/setup/test-setup.ts'],
    pool: 'forks', // isolamento entre arquivos de teste
    poolOptions: {
      forks: { singleFork: false }
    }
  }
})
```

```typescript
// tests/setup/global-setup.ts
import { execSync } from 'child_process'

export async function setup() {
  // Rodar migrations no banco de teste
  execSync('DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy', {
    stdio: 'inherit'
  })
}

export async function teardown() {
  // Limpeza opcional — o banco de teste é recriado a cada run
}
```

```typescript
// tests/setup/test-setup.ts
import { prisma } from '@/lib/prisma'
import { afterEach } from 'vitest'

afterEach(async () => {
  // Limpar dados entre testes (ordem importa: FK constraints)
  await prisma.$transaction([
    prisma.empenho.deleteMany(),
    prisma.dotacao.deleteMany(),
    prisma.tenant.deleteMany(),
  ])
})
```

### Padrão de fixture de tenant

```typescript
// tests/fixtures/tenant.fixture.ts
import { prisma } from '@/lib/prisma'

export async function criarTenantFixture(orgId = 'org_test_A') {
  return prisma.tenant.create({
    data: {
      orgId,
      nome: `Tenant de Teste — ${orgId}`,
      ativo: true,
    }
  })
}

export async function criarDotacaoFixture(tenantId: string, saldo = '10000.00') {
  return prisma.dotacao.create({
    data: {
      tenantId,
      descricao: 'Dotação de teste',
      valorTotal: new Prisma.Decimal(saldo),
      valorEmpenhado: new Prisma.Decimal('0.00'),
      status: 'ATIVA',
    }
  })
}
```

### Teste de integração de Server Action

```typescript
// src/modules/empenho/__tests__/criar-empenho.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { criarEmpenho } from '../actions/criar-empenho'
import { criarTenantFixture, criarDotacaoFixture } from '@/tests/fixtures/tenant.fixture'
import { mockClerkAuth } from '@/tests/mocks/clerk.mock'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

describe('criarEmpenho — integração', () => {
  let tenantId: string
  let dotacaoId: string

  beforeEach(async () => {
    const tenant = await criarTenantFixture('org_test_A')
    tenantId = tenant.id
    const dotacao = await criarDotacaoFixture(tenantId, '10000.00')
    dotacaoId = dotacao.id
    mockClerkAuth({ orgId: 'org_test_A', userId: 'user_test_1', role: 'operador' })
  })

  it('cria empenho e atualiza saldo da dotação corretamente', async () => {
    const resultado = await criarEmpenho({
      dotacaoId,
      valor: '3000.00',
      descricao: 'Empenho de teste',
    })

    expect(resultado.error).toBeNull()
    expect(resultado.data?.valor.toString()).toBe('3000.00')

    // Verificar efeito colateral no banco — não apenas a resposta
    const dotacaoAtualizada = await prisma.dotacao.findUnique({
      where: { id: dotacaoId }
    })
    expect(dotacaoAtualizada?.valorEmpenhado.toString()).toBe('3000.00')
  })

  it('rejeita empenho quando saldo é insuficiente', async () => {
    const resultado = await criarEmpenho({
      dotacaoId,
      valor: '15000.00', // maior que o saldo de 10000
      descricao: 'Empenho inválido',
    })

    expect(resultado.error).toBe('SALDO_INSUFICIENTE')
    expect(resultado.data).toBeNull()

    // Banco não deve ter sido modificado
    const dotacao = await prisma.dotacao.findUnique({ where: { id: dotacaoId } })
    expect(dotacao?.valorEmpenhado.toString()).toBe('0.00')
  })

  it('bloqueia acesso de tenant diferente', async () => {
    mockClerkAuth({ orgId: 'org_test_B', userId: 'user_test_2', role: 'operador' })

    const resultado = await criarEmpenho({
      dotacaoId, // dotação pertence ao org_test_A
      valor: '1000.00',
      descricao: 'Tentativa cross-tenant',
    })

    expect(resultado.error).toBe('NAO_AUTORIZADO')
  })
})
```

---

## Playwright — Testes E2E

### Configuração base

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // SGO 2.0: evitar race condition entre testes financeiros
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

### Page Object Model (POM)

```typescript
// e2e/pages/empenho.page.ts
import { Page, Locator } from '@playwright/test'

export class EmpenhoPage {
  readonly page: Page
  readonly inputValor: Locator
  readonly inputDescricao: Locator
  readonly btnConfirmar: Locator
  readonly mensagemSucesso: Locator
  readonly mensagemErro: Locator

  constructor(page: Page) {
    this.page = page
    this.inputValor = page.getByLabel('Valor do empenho')
    this.inputDescricao = page.getByLabel('Descrição')
    this.btnConfirmar = page.getByRole('button', { name: 'Confirmar empenho' })
    this.mensagemSucesso = page.getByText('Empenho registrado com sucesso')
    this.mensagemErro = page.getByRole('alert')
  }

  async navegarPara(dotacaoId: string) {
    await this.page.goto(`/dotacoes/${dotacaoId}/empenhos/novo`)
  }

  async preencherEmpenho(valor: string, descricao: string) {
    await this.inputValor.fill(valor)
    await this.inputDescricao.fill(descricao)
  }

  async confirmar() {
    await this.btnConfirmar.click()
  }
}
```

### Teste E2E com autenticação Clerk

```typescript
// e2e/empenho.spec.ts
import { test, expect } from '@playwright/test'
import { EmpenhoPage } from './pages/empenho.page'
import { autenticarComo } from './helpers/auth.helper'

test.describe('Fluxo de empenho de dotação', () => {
  test.beforeEach(async ({ page }) => {
    await autenticarComo(page, 'operador') // helper que faz login via Clerk test mode
  })

  test('operador consegue empenhar dotação com saldo disponível', async ({ page }) => {
    const empenhoPage = new EmpenhoPage(page)
    await empenhoPage.navegarPara('dotacao-id-de-teste')
    await empenhoPage.preencherEmpenho('3000,00', 'Empenho de material de escritório')
    await empenhoPage.confirmar()

    await expect(empenhoPage.mensagemSucesso).toBeVisible()
    // Verificar que o saldo atualizado aparece na tela
    await expect(page.getByTestId('saldo-disponivel')).toContainText('7.000,00')
  })

  test('exibe erro claro quando saldo é insuficiente', async ({ page }) => {
    const empenhoPage = new EmpenhoPage(page)
    await empenhoPage.navegarPara('dotacao-id-de-teste')
    await empenhoPage.preencherEmpenho('999999,00', 'Empenho além do saldo')
    await empenhoPage.confirmar()

    await expect(empenhoPage.mensagemErro).toContainText('Saldo insuficiente')
    // Banco não deve ter sido modificado — saldo deve permanecer o mesmo
  })
})
```

---

## Checklist antes de commitar testes

- [ ] Testes são determinísticos — mesmo resultado em toda execução
- [ ] Nenhum teste depende da ordem de execução de outro
- [ ] Fixtures criam e destroem seus próprios dados (não dependem de dados pré-existentes)
- [ ] Todo teste de integração verifica o estado do banco, não apenas o retorno da função
- [ ] Todo teste que usa tenant declara explicitamente qual tenant está em contexto
- [ ] Testes E2E usam `data-testid` para seletores críticos — não texto que pode mudar
- [ ] Nenhum `test.only` ou `it.only` commitado (quebra CI silenciosamente)
