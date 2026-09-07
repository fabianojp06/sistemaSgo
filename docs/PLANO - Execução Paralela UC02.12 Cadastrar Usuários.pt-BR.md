# Plano de Execução Paralela — UC02.12 (Cadastrar Usuários)

**Épico:** EP085/24 — Módulo de Administração
**US cobertas:** [[US-201]], [[US-202]], [[US-203]], [[US-204]], [[US-205]]
**Objetivo:** maximizar o número de US desenvolvidas simultaneamente (meta: **4 frentes em paralelo**).

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

Wave 1 — FAN-OUT (paralelo) ................... 4 agentes fullstack-dev · simultâneos
   Frente B  feat/us-201-criar-usuario     — CriarUsuarioUseCase + $transaction + compensação
                                             + ConviteIdentidadeService (impl Clerk) + actions/criar.ts
   Frente C  feat/us-202-associar-perfis   — AssociarPerfisUsuarioUseCase + ListarPerfisAtivosUseCase
                                             + PainelPerfisAcesso.tsx + actions/perfis.ts
   Frente D  feat/us-203-excecoes-acesso   — DefinirExcecoesAcessoUsuarioUseCase
                                             + resolverPermissaoEfetiva (corpo real) + PainelExcecoesPerfil.tsx
                                             + REGRESSÃO menu/permissão (gate de PR)
   Frente E  feat/us-204-acesso-inicial    — GerarAcessoInicialUsuarioUseCase + ReenviarConviteUsuarioUseCase
                                             + BadgeSituacaoAcesso.tsx + actions/convite.ts + webhook

Wave 2 — INTEGRAÇÃO + HARDENING (serial curto) . 1 agente · ~0,5 dia
   feat/us-201-integracao — Frente B costura os painéis no CadastrarUsuarioForm + E2E do fluxo feliz
   feat/us-205-hardening  — E2E de autorização (action direta, 403, sessão expirada, tenant, sistema inativo)
```

**Máximo simultâneo: 4 frentes (Wave 1).**

## Ordem de merge da Wave 1

1. **C** e **E** — independentes entre si; qualquer ordem.
2. **D** — após C (compartilham painel-pai e conceito de "perfil selecionado"). PR com gate de regressão de menu/permissão.
3. **B** (use-case/action) — desenvolve em paralelo; mergeia após C/D/E (a `$transaction` chama os três).
4. **Wave 2** — integração da tela + E2E de autorização.

## Matriz de propriedade de arquivos (Wave 1 — zero colisão)

| Arquivo | B | C | D | E |
|---|:-:|:-:|:-:|:-:|
| `application/use-cases/administracao/CriarUsuarioUseCase.ts` | ✅ | | | |
| `infrastructure/auth/ClerkConviteIdentidadeService.ts` | ✅ | | | |
| `app/(autenticado)/administracao/usuarios/actions/criar.ts` | ✅ | | | |
| `.../AssociarPerfisUsuarioUseCase.ts` · `.../ListarPerfisAtivosUseCase.ts` | | ✅ | | |
| `.../actions/perfis.ts` · `PainelPerfisAcesso.tsx` | | ✅ | | |
| `.../DefinirExcecoesAcessoUsuarioUseCase.ts` · `domain/administracao/resolverPermissaoEfetiva.ts` | | | ✅ | |
| `PainelExcecoesPerfil.tsx` | | | ✅ | |
| `.../GerarAcessoInicialUsuarioUseCase.ts` · `.../ReenviarConviteUsuarioUseCase.ts` | | | | ✅ |
| `.../actions/convite.ts` · `BadgeSituacaoAcesso.tsx` · webhook clerk | | | | ✅ |
| `.../administracao/container.ts` (ou `container.<frente>.ts` + barrel) | ✏️ | ✏️ | ✏️ | ✏️ |
| `ObterMenuUsuarioUseCase` / `usuarioTemFuncionalidade` | | 👀 | ✏️(D) | |
| `.../usuarios/page.tsx` (formulário) | 🔒 Wave 2 | | | |

✏️ linhas disjuntas (merge trivial) · 🔒 tocado só na Wave 2 · 👀 consome assinatura, não edita.

## Regras para os agentes das frentes

- **Não editar `prisma/schema.prisma`.** Falta de campo = erro de contrato: parar e escalar.
- **Não editar arquivo fora da própria coluna da matriz** (exceto `container.<frente>.ts` próprio).
- **Migration:** só a Wave 0. `migrate dev` contra shadow **local** (docker) — NUNCA Supabase (ver `DEV_SHADOW_DATABASE.md` e regra do incidente 2026-08-14 em `CLAUDE.md`).
- **Frente D:** rodar `npm test` de `ObterMenuUsuarioUseCase` + `verificarPermissao` antes do PR; anexar resultado.
- **Frente B:** teste obrigatório do caminho de compensação (Clerk cria → Postgres falha → `revogarConvite`).
- Todo PR passa por `/code-review` (fluxo Git híbrido — migration + use-case = branch + PR).

## Composição transacional

`CriarUsuarioUseCase` (B) abre `prisma.$transaction` e chama, por dentro, passando `tx`:
`AssociarPerfisUsuarioUseCase` (C) → `DefinirExcecoesAcessoUsuarioUseCase` (D) → grava `situacaoAcesso` + log de acesso inicial (E). Ponto único de commit; C/D/E fornecem funções que operam no `tx` recebido, sem abrir transação própria.

## Pendências a fechar DENTRO da Wave 0

1. **API de convite do Clerk no plano free** — confirmar `invitations.createInvitation`; fallback `users.createUser({ skipPasswordRequirement: true })` + e-mail de reset. Decisão isolada pela porta `ConviteIdentidadeService`.
2. **Campo `login`** — adicionar `login String @unique` em `Usuario` (hoje só há `email` único). Decidir se espelha no Clerk como `username`.
3. **"Perfil ativo"** — resolvido por `Perfil.ativo @default(true)` (backward-compatible).
4. **`resolverPermissaoEfetiva`** — assinatura congelada; `ObterMenuUsuarioUseCase` e `usuarioTemFuncionalidade` passam a delegar já na Wave 0 (passthrough), para a Frente D só trocar o corpo.

## Resumo

| | |
|---|---|
| Frentes simultâneas | **4** |
| Pré-requisito | 1 PR de fundação (~0,5–1 dia) |
| PRs totais | 1 + 4 + 2 = **7** |
| Ganho vs serial | ~2–2,5× no trecho de implementação |
| Maior risco | fundação inchar / US-203 regredir permissão — mitigados por "só contratos" e exceção aditiva por ausência |
