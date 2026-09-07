# Plano de Execução Paralela — UC02.12 (Cadastrar Usuários)

**Épico:** EP085/24 — Módulo de Administração
**US cobertas:** [[US-201]], [[US-202]], [[US-203]], [[US-204]], [[US-205]]
**Objetivo:** maximizar o número de US desenvolvidas simultaneamente.

> **Atualização 2026-09-07 — sem envio de e-mail nesta fase.** O Clerk segue como
> provedor de identidade (login normal), mas o convite/e-mail de definição de senha
> fica adiado. A US-204 encolhe para uma fatia mínima (definir `situacaoAcesso` +
> auditoria), absorvida pela Frente B. **Frentes ativas na Wave 1: 3 (B, C, D).**
> Fundação mergeada (PR #22) + ajuste `feat/uc0212-fundacao-ajuste-sem-convite`.

## Estratégia

As 5 US convergem para 4 arquivos compartilhados (`prisma/schema.prisma`, a pasta de Server Actions da rota nova, `container.ts`, o formulário) e a US-203 altera código de permissão usado em produção. Paralelizar direto = conflito garantido.

Solução: **1 PR de fundação bloqueante** que congela todos os contratos, seguido de **4 frentes independentes**, seguido de **cauda serial de integração**.

## Waves

```
Wave 0 — FUNDAÇÃO (serial, bloqueante) ......... 1 agente · ~0,5–1 dia
  PR: feat/uc0212-fundacao → /code-review → merge
  Entrega SÓ contratos (nenhuma regra de negócio):
   - schema + migration: Usuario.login, Usuario.situacaoAcesso, Perfil.ativo, Perfil.descricao,
     model UsuarioPerfilExcecao, novos valores de TipoOperacao
   - stubs tipados dos use-cases (corpo = throw 'não implementado')
   - porta ConviteIdentidadeService
   - guardAdministrador() (núcleo)
   - resolverPermissaoEfetiva() com assinatura congelada + delegação passthrough
     em ObterMenuUsuarioUseCase e usuarioTemFuncionalidade
   - scaffold da rota app/(autenticado)/administracao/usuarios/ (page + actions/ + layout)
   - errors de domínio (src/domain/administracao/errors.ts)

Wave 1 — FAN-OUT (paralelo) ................... 3 agentes fullstack-dev · simultâneos
   Frente B  feat/us-201-criar-usuario     — CriarUsuarioUseCase + $transaction + compensação
                                             + ClerkIdentidadeUsuarioService (users.createUser, SEM e-mail)
                                             + GerarAcessoInicialUsuarioUseCase (fatia US-204: situacaoAcesso + audit)
                                             + BadgeSituacaoAcesso.tsx + webhook (promoção a ACESSO_ATIVO)
                                             + actions/criar.ts
   Frente C  feat/us-202-associar-perfis   — AssociarPerfisUsuarioUseCase + ListarPerfisAtivosUseCase
                                             + PainelPerfisAcesso.tsx + actions/perfis.ts
   Frente D  feat/us-203-excecoes-acesso   — DefinirExcecoesAcessoUsuarioUseCase
                                             + resolverPermissaoEfetiva (corpo real) + PainelExcecoesPerfil.tsx
                                             + REGRESSÃO menu/permissão (gate de PR)

   (US-204 fatia adiada — ReenviarConviteUsuarioUseCase/actions/convite.ts ficam stub "adiado")

Wave 2 — INTEGRAÇÃO + HARDENING (serial curto) . 1 agente · ~0,5 dia
   feat/us-201-integracao — Frente B costura os painéis no CadastrarUsuarioForm + E2E do fluxo feliz
   feat/us-205-hardening  — E2E de autorização (action direta, 403, sessão expirada, tenant, sistema inativo)
```

**Máximo simultâneo: 3 frentes (Wave 1).**

## Ordem de merge da Wave 1

1. **C** — sem overlap com D/B nos arquivos próprios.
2. **D** — após C (compartilham painel-pai e conceito de "perfil selecionado"). PR com gate de regressão de menu/permissão.
3. **B** (use-case/action + fatia US-204) — desenvolve em paralelo; mergeia após C/D (a `$transaction` chama os dois).
4. **Wave 2** — integração da tela + E2E de autorização.

## Matriz de propriedade de arquivos (Wave 1 — zero colisão)

| Arquivo | B | C | D |
|---|:-:|:-:|:-:|
| `application/use-cases/administracao/CriarUsuarioUseCase.ts` · `GerarAcessoInicialUsuarioUseCase.ts` | ✅ | | |
| `infrastructure/auth/ClerkIdentidadeUsuarioService.ts` | ✅ | | |
| `app/(autenticado)/administracao/usuarios/actions/criar.ts` · `BadgeSituacaoAcesso.tsx` · webhook clerk | ✅ | | |
| `.../AssociarPerfisUsuarioUseCase.ts` · `.../ListarPerfisAtivosUseCase.ts` | | ✅ | |
| `.../actions/perfis.ts` · `PainelPerfisAcesso.tsx` | | ✅ | |
| `.../DefinirExcecoesAcessoUsuarioUseCase.ts` · `domain/administracao/resolverPermissaoEfetiva.ts` | | | ✅ |
| `PainelExcecoesPerfil.tsx` | | | ✅ |
| `.../administracao/container.ts` (ou `container.<frente>.ts` + barrel) | ✏️ | ✏️ | ✏️ |
| `ObterMenuUsuarioUseCase` / `usuarioTemFuncionalidade` | | 👀 | ✏️(D) |
| `.../usuarios/page.tsx` (formulário) | 🔒 Wave 2 | | |
| `.../actions/convite.ts` · `ReenviarConviteUsuarioUseCase.ts` | ⛔ stub "adiado" — ninguém toca nesta fase | | |

✏️ linhas disjuntas (merge trivial) · 🔒 tocado só na Wave 2 · 👀 consome assinatura, não edita.

## Regras para os agentes das frentes

- **Não editar `prisma/schema.prisma`.** Falta de campo = erro de contrato: parar e escalar.
- **Não editar arquivo fora da própria coluna da matriz** (exceto `container.<frente>.ts` próprio).
- **Migration:** só a Wave 0. `migrate dev` contra shadow **local** (docker) — NUNCA Supabase (ver `DEV_SHADOW_DATABASE.md` e regra do incidente 2026-08-14 em `CLAUDE.md`).
- **Frente D:** rodar `npm test` de `ObterMenuUsuarioUseCase` + `verificarPermissao` antes do PR; anexar resultado.
- **Frente B:** teste obrigatório do caminho de compensação (Clerk cria identidade → Postgres falha → `excluirIdentidade`).
- Todo PR passa por `/code-review` (fluxo Git híbrido — migration + use-case = branch + PR).

## Composição transacional

`CriarUsuarioUseCase` (B) abre `prisma.$transaction` e chama, por dentro, passando `tx`:
`AssociarPerfisUsuarioUseCase` (C) → `DefinirExcecoesAcessoUsuarioUseCase` (D) → grava `situacaoAcesso = CONVITE_PENDENTE` + log `USUARIO_ACESSO_GERADO` (fatia US-204, também na Frente B). Ponto único de commit; C/D fornecem funções que operam no `tx` recebido, sem abrir transação própria.

## Status da Wave 0 (fundação)

✅ Mergeada — PR #22 + ajuste `feat/uc0212-fundacao-ajuste-sem-convite`.
1. ~~API de convite do Clerk~~ → **decidido: sem e-mail nesta fase.** `IdentidadeUsuarioService.criarIdentidade` usa `users.createUser({ skipPasswordRequirement: true })`; `excluirIdentidade` para compensação.
2. ✅ `login String @unique` em `Usuario` (espelhado no Clerk como `username`; webhook deriva de `username` ou parte local do e-mail).
3. ✅ `Perfil.ativo @default(true)`.
4. ✅ `resolverPermissaoEfetiva` congelado + delegação passthrough em `ObterMenuUsuarioUseCase` e `usuarioTemFuncionalidade` (439 testes verdes).

## Resumo

| | |
|---|---|
| Frentes simultâneas | **3** (B, C, D) |
| Pré-requisito | ✅ Fundação mergeada |
| PRs restantes | 3 (frentes) + 2 (integração/hardening) |
| US-204 | fatia mínima na Frente B; envio de e-mail adiado |
| Maior risco | US-203 regredir permissão — mitigado por exceção aditiva por ausência + gate de regressão |
