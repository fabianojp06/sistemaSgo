<div align="center">

# SGO — Sistema de Gestão Orçamentária

**Plataforma de gestão orçamentária multi-tenant para OSCIPs e organizações públicas**

[🇧🇷 Português](README.md) · [🇺🇸 English](README.en-US.md)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?logo=postgresql&logoColor=white)
![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)

</div>

---

## Sobre o projeto

O SGO 2.0 é um sistema de gestão orçamentária multi-tenant, construído para organizações que operam
sob Termos de Parceria e contratos orçamentários (ciclo LOA/PPA). O módulo em desenvolvimento atual —
**Cadastros (EP118/24)** — cobre Plano de Contas, Propostas/Versões, Estrutura Funcional, Cargos e
Salários, Empregados, Viagens e Bens Patrimoniais.

Isolamento por tenant (organização) é um requisito não-negociável em toda a base de código: cada
organização no Clerk mapeia para um `tenantId`, presente em todo modelo e toda consulta ao banco.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router + Server Actions) |
| Linguagem | TypeScript (modo estrito) |
| UI | React 19 + [Tailwind CSS 4](https://tailwindcss.com) |
| ORM / Banco | [Prisma 6](https://www.prisma.io) + PostgreSQL ([Supabase](https://supabase.com), plano gratuito) |
| Autenticação | [Clerk](https://clerk.com) (plano gratuito) — organizações = tenants |
| Validação | [Zod](https://zod.dev) |
| Testes | [Vitest](https://vitest.dev) (unitário) + [Playwright](https://playwright.dev) (E2E) |

## Arquitetura

Camadas inspiradas em DDD/Clean Architecture, isolando regra de negócio de infraestrutura:

```
src/
├─ app/                    # Rotas Next.js (App Router) + Server Actions
├─ domain/                 # Entidades e regras de negócio puras (sem I/O)
├─ application/use-cases/  # Casos de uso — orquestram domínio + infraestrutura
├─ infrastructure/         # Prisma, Clerk, integrações externas (ERP Senior, Rubi)
└─ lib/                    # Utilitários compartilhados
```

Toda operação financeira/transacional passa por `prisma.$transaction()`, com auditoria gravada em
`HistoricoOperacao` na mesma transação — nunca fora dela.

## Rodando localmente

Pré-requisitos: Node.js 20+, uma instância PostgreSQL (recomendado: [Supabase](https://supabase.com) plano gratuito) e uma aplicação [Clerk](https://clerk.com) (plano gratuito).

```bash
# 1. Configurar variáveis de ambiente
cp .env.example .env
# preencha POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, credenciais do Clerk, etc.

# 2. Instalar dependências (gera o Prisma Client automaticamente via postinstall)
npm install

# 3. Aplicar migrations
npm run prisma:migrate

# 4. Subir o servidor de desenvolvimento
npm run dev
```

## Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor de desenvolvimento Next.js |
| `npm run build` | Build de produção |
| `npm run start` | Sobe o build de produção |
| `npm run lint` | Roda o ESLint |
| `npm run format` | Formata o código com Prettier |
| `npm test` | Roda a suíte de testes unitários (Vitest) |
| `npm run test:e2e` | Roda os testes end-to-end (Playwright) |
| `npm run prisma:generate` | Gera o Prisma Client a partir do schema |
| `npm run prisma:migrate` | Cria/aplica migrations em desenvolvimento |
| `npm run prisma:seed` | Popula o banco com dados de exemplo |

## Estrutura do repositório

```
├─ src/                 # Código-fonte da aplicação (ver Arquitetura acima)
├─ prisma/              # schema.prisma + histórico de migrations
├─ docs/                # Documentação funcional: Histórias de Usuário (US-NNN),
│                        # critérios de aceite, dicionário de dados — bilíngue
│                        # (.pt-BR.md / .en-US.md, tradução em andamento)
├─ requisitos/          # Documentos de requisitos originais do cliente
└─ dados/exemplos/      # Massa de dados de exemplo para desenvolvimento local
```

## Testes

```bash
npm test          # unitários (Vitest)
npm run test:e2e  # end-to-end (Playwright)
```

## Documentação funcional

As Histórias de Usuário (`US-NNN`) e Casos de Uso (`UC0X.YY`) do módulo em desenvolvimento estão em
[`docs/`](docs/), com critérios de aceite em formato BDD/Gherkin. Cada documento nasce em português
(`.pt-BR.md`) com uma versão em inglês correspondente (`.en-US.md`) — a tradução retroativa dos
documentos mais antigos está em andamento.

---

<div align="center">

**[🇧🇷 Você está na versão em Português](README.md)** · **[🇺🇸 Read this in English](README.en-US.md)**

</div>
