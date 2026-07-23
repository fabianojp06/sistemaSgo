# SGO — Sistema de Gestão Orçamentária

## Stack
- Next.js 16 (App Router) + TypeScript
- Prisma + PostgreSQL (Supabase, plano gratuito)
- Clerk (autenticação, plano gratuito)
- Tailwind CSS
- Zod (validação)
- Vitest (testes)

## Rodando localmente
```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run dev
```

## Estrutura
- `src/app/` — rotas Next.js (App Router)
- `src/domain/` — entidades e regras de negócio puras
- `src/application/use-cases/` — casos de uso (orquestração de domínio)
- `src/infrastructure/` — Prisma, Clerk, integrações externas
- `src/lib/` — utilitários compartilhados
- `prisma/` — schema e migrations
- `docs/` — documentação do módulo em desenvolvimento (TAP, EP, CA, dicionário de dados)
- `requisitos/` — requisitos do sistema
- `dados/exemplos` — dados de exemplo
