<div align="center">

# SGO — Budget Management System

**Multi-tenant budget management platform for OSCIPs and public organizations**

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

## About

SGO 2.0 is a multi-tenant budget management system, built for organizations operating under
Partnership Agreements and budget contracts (LOA/PPA cycle). The module currently under
development — **Registrations (EP118/24)** — covers Chart of Accounts, Proposals/Versions,
Organizational Structure, Positions and Salaries, Employees, Travel, and Fixed Assets.

Tenant (organization) isolation is a non-negotiable requirement across the entire codebase: each
organization in Clerk maps to a `tenantId`, present in every model and every database query.

## Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router + Server Actions) |
| Language | TypeScript (strict mode) |
| UI | React 19 + [Tailwind CSS 4](https://tailwindcss.com) |
| ORM / Database | [Prisma 6](https://www.prisma.io) + PostgreSQL ([Supabase](https://supabase.com), free tier) |
| Authentication | [Clerk](https://clerk.com) (free tier) — organizations = tenants |
| Validation | [Zod](https://zod.dev) |
| Testing | [Vitest](https://vitest.dev) (unit) + [Playwright](https://playwright.dev) (E2E) |

## Architecture

Layers inspired by DDD/Clean Architecture, isolating business rules from infrastructure:

```
src/
├─ app/                    # Next.js routes (App Router) + Server Actions
├─ domain/                 # Pure entities and business rules (no I/O)
├─ application/use-cases/  # Use cases — orchestrate domain + infrastructure
├─ infrastructure/         # Prisma, Clerk, external integrations (Senior ERP, Rubi)
└─ lib/                    # Shared utilities
```

Every financial/transactional operation goes through `prisma.$transaction()`, with the audit
trail written to `HistoricoOperacao` within the same transaction — never outside it.

## Running locally

Prerequisites: Node.js 20+, a PostgreSQL instance (recommended: [Supabase](https://supabase.com) free tier), and a [Clerk](https://clerk.com) application (free tier).

```bash
# 1. Configure environment variables
cp .env.example .env
# fill in POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, Clerk credentials, etc.

# 2. Install dependencies (generates the Prisma Client automatically via postinstall)
npm install

# 3. Apply migrations
npm run prisma:migrate

# 4. Start the development server
npm run dev
```

## Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Starts the production build |
| `npm run lint` | Runs ESLint |
| `npm run format` | Formats the code with Prettier |
| `npm test` | Runs the unit test suite (Vitest) |
| `npm run test:e2e` | Runs the end-to-end tests (Playwright) |
| `npm run prisma:generate` | Generates the Prisma Client from the schema |
| `npm run prisma:migrate` | Creates/applies migrations in development |
| `npm run prisma:seed` | Seeds the database with sample data |

## Repository structure

```
├─ src/                 # Application source code (see Architecture above)
├─ prisma/              # schema.prisma + migration history
├─ docs/                # Functional documentation: User Stories (US-NNN),
│                        # acceptance criteria, data dictionary — bilingual
│                        # (.pt-BR.md / .en-US.md, translation in progress)
├─ requisitos/          # Original client requirement documents
└─ dados/exemplos/      # Sample data set for local development
```

## Testing

```bash
npm test          # unit tests (Vitest)
npm run test:e2e  # end-to-end tests (Playwright)
```

## Functional documentation

The User Stories (`US-NNN`) and Use Cases (`UC0X.YY`) of the module under development live in
[`docs/`](docs/), with acceptance criteria in BDD/Gherkin format. Each document is written first
in Portuguese (`.pt-BR.md`) with a corresponding English version (`.en-US.md`) — retroactive
translation of older documents is in progress.

---

<div align="center">

**[🇧🇷 Ver esta página em Português](README.md)** · **[🇺🇸 You are viewing the English version](README.en-US.md)**

</div>
