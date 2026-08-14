# Shadow Database local (dev) — por que existe

## Incidente 2026-08-14

Durante uma investigação de "drift" pedida pelo usuário, rodei:

```
npx prisma migrate diff --from-migrations prisma/migrations --to-url "$DATABASE_URL" --shadow-database-url "$DATABASE_URL"
```

Passei a **mesma URL de produção** como `--to-url` E como `--shadow-database-url`. O Prisma trata
o shadow database como descartável (recria schema nele para testar as migrations) — como apontei
os dois parâmetros para o banco real, isso **apagou todos os dados de produção** (Usuario, Proposta,
Cargo, Empregado, etc.), preservando só a estrutura das tabelas e o histórico de migrations. Sem
backup disponível no plano gratuito do Supabase, os dados de negócio foram perdidos de forma
definitiva. Só foi possível restaurar acesso ao sistema (resincronizando `Usuario`/`Perfil` a partir
do Clerk, que não foi afetado) — todo o resto precisou ser recadastrado manualmente.

## Regra permanente a partir de agora

**Nunca** rodar `prisma migrate dev` ou `prisma migrate diff --shadow-database-url` apontando,
direta ou indiretamente, para a URL de produção (Supabase). O shadow database é sempre um Postgres
**local e descartável**, nunca a instância real.

## Como subir o shadow database local

```bash
docker run -d --name sgo-shadow-db \
  -e POSTGRES_PASSWORD=shadow -e POSTGRES_DB=shadow \
  -p 5433:5432 postgres:16-alpine
```

Já configurado em:
- `prisma/schema.prisma` — `datasource db` tem `shadowDatabaseUrl = env("SHADOW_DATABASE_URL")`.
- `.env` — `SHADOW_DATABASE_URL="postgresql://postgres:shadow@localhost:5433/shadow"`.

Sem esse container rodando, `prisma migrate dev` falha ao tentar conectar no shadow — isso é
proposital (falha explícita é melhor que silenciosamente usar produção).

## O que NÃO precisa de shadow database

- `prisma migrate deploy` (usado em CI/`Supabase Migrate` workflow) — só aplica migrations
  pendentes, nunca cria/usa shadow database. Seguro contra produção.
- `prisma migrate status`, `prisma generate`, `prisma db execute` — também não usam shadow.

O risco é só em `migrate dev` (ambiente local) e `migrate diff --shadow-database-url` (comandos de
diagnóstico manual) — exatamente o que causou o incidente.
