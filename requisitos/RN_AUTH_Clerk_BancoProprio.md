# Regras de Negócio — Revisão: Autenticação via Clerk + Banco Próprio

**Módulo:** Autenticação e Tela Principal (EP084/24)
**Documento fonte:** EP084/24, DC_EP084_24, CA_UC01_01/02/05
**Motivo da revisão:** ADR-001 (Tech Lead) decidiu usar Clerk para gestão de senha/hash/sessão, mantendo em banco próprio (`usuario`) os campos de negócio que o Clerk não modela: `status`, `bloqueado`, `contador_falhas`, `flag_manutencao` (parâmetro) e a auditoria `historico_operacao`.
**Status:** Proposto — pendente de validação com o dono do produto antes da implementação.
**Elaboração:** Analista de Negócios/PO (SGO 2.0)

Esta revisão **não substitui** o EP084/24 original em `docs/` — é um adendo que reinterpreta as regras de negócio à luz da divisão de responsabilidade Clerk × banco próprio. Onde não há conflito, a regra original permanece válida e não é repetida aqui.

---

## Divisão de responsabilidade

| Responsabilidade | Onde vive |
|---|---|
| Armazenar e validar senha (hash, comparação) | **Clerk** |
| Emitir e gerenciar sessão/token | **Clerk** |
| `status` (ATIVO/INATIVO) | **Banco próprio** (`usuario.status`) |
| `bloqueado` + `contador_falhas` | **Banco próprio** (`usuario.bloqueado`, `usuario.contador_falhas`) |
| `flag_manutencao` (parâmetro global) | **Banco próprio** (tabela de parâmetros) |
| `historico_operacao` (auditoria append-only) | **Banco próprio** |
| Identidade do usuário (nome, e-mail, login) | **Clerk é a fonte de verdade de e-mail/login de acesso; `usuario.nome_completo` fica no banco próprio, vinculado por `clerk_user_id`** |

Consequência direta: `usuario.senha_hash` **deixa de existir** no nosso schema — RN0019, RN0020, RNF0004 e RNF0005 (hash Argon2id/PBKDF2/BCrypt, comparação case-sensitive, constant-time) passam a ser responsabilidade do Clerk, não mais código nosso. Não implementamos nem auditamos o algoritmo de hash — confiamos na implementação do Clerk.

---

## RN0012-rev — Ordem de verificação na autenticação

**Domínio:** Autenticação
**Módulo SGO:** UC01.02 — Autenticar Usuário

**Descrição:**
A verificação de elegibilidade para autenticar (status, bloqueio, manutenção) ocorre **antes** de delegar a validação de senha ao Clerk. Isso preserva RN0018 e RN0023 (que exigem rejeitar sem verificar senha), mesmo com a senha sendo validada por um serviço externo.

**Condição de aplicação:**
Toda tentativa de login (UC01.01 → UC01.02).

**Validações obrigatórias:**
| # | Validação | Mensagem de erro | Ação do sistema |
|---|-----------|-------------------|-------------------|
| 1 | `flag_manutencao = TRUE` e usuário não é Administrador | "Sistema está em manutenção" | Bloquear — **não chama o Clerk** |
| 2 | `usuario.bloqueado = TRUE` | "Usuário bloqueado" | Bloquear — **não chama o Clerk** |
| 3 | `usuario.status = 'INATIVO'` | "Login ou senha inválidos" | Bloquear — **não chama o Clerk** |
| 4 | Login não existe no banco próprio | "Login ou senha inválidos" | Bloquear — **não chama o Clerk** (evita vazar ao Clerk tentativas para logins inexistentes no nosso domínio) |
| 5 | Todas as anteriores passaram | — | Delega a validação de senha ao Clerk (`signIn`) |

**Exemplos concretos:**
- ✅ Válido: usuário ATIVO, não bloqueado, sistema fora de manutenção → prossegue para o Clerk validar a senha.
- ❌ Inválido: usuário com `bloqueado = TRUE` tenta logar → sistema responde "Usuário bloqueado" sem nunca chamar `clerkClient.signIn`.

**Por que essa ordem importa:** se delegássemos ao Clerk primeiro, uma conta com senha correta no Clerk mas `bloqueado = TRUE` no nosso banco autenticaria com sucesso no Clerk antes de sermos capazes de barrar — violando RN0018 e CA-01.02.08.

---

## RN0024-rev — Bloqueio automático sincronizado após resposta do Clerk

**Domínio:** Segurança / Autenticação
**Módulo SGO:** UC01.02, UC01.05

**Descrição:**
Como o Clerk é quem informa se a senha está correta, o incremento de `contador_falhas` e o acionamento do bloqueio automático (UC01.05) só podem ocorrer **depois** que o Clerk retornar o resultado da tentativa (sucesso ou falha de senha) — nunca antes.

**Condição de aplicação:**
Toda resposta do Clerk a uma tentativa de `signIn` para um usuário que passou pelas verificações de RN0012-rev.

**Validações obrigatórias:**
| # | Validação | Mensagem de erro | Ação do sistema |
|---|-----------|-------------------|-------------------|
| 1 | Clerk retorna senha correta | — | Zerar `contador_falhas` (RN0025), registrar `LOGIN_SUCESSO`, prosseguir criação de sessão |
| 2 | Clerk retorna senha incorreta | "Login ou senha inválidos" | Incrementar `contador_falhas` em nosso banco (+1), registrar `LOGIN_FALHA` |
| 3 | `contador_falhas` (após incremento) atinge `limite_tentativas_login` | "Usuário bloqueado" | Acionar UC01.05 — gravar `bloqueado = TRUE` de forma atômica |

**Exemplos concretos:**
- ✅ Válido: Clerk confirma senha correta → nosso banco zera `contador_falhas` e grava `LOGIN_SUCESSO`.
- ❌ Inválido: nosso backend incrementaria `contador_falhas` **antes** de chamar o Clerk, "torcendo" para a senha estar errada — isso quebraria a regra em caso de falha de rede com o Clerk (falso incremento). O incremento só acontece com o veredito do Clerk em mãos.

**Risco assumido:** existe uma janela onde o Clerk já autenticou a sessão, mas a gravação local de `LOGIN_SUCESSO`/zeragem do contador falha (equivalente ao antigo E6 — falha de auditoria pós-login). Mantém-se a regra original: a falha de auditoria **não** desfaz a sessão já criada pelo Clerk; o erro é registrado internamente para revisão (ver RN0024-rev nota abaixo, equivalente a CA-01.02.19).

---

## RN0018/RN0021-rev — Mensagens genéricas continuam responsabilidade nossa

**Domínio:** Segurança
**Módulo SGO:** UC01.01, UC01.02

**Descrição:**
As mensagens "Login ou senha inválidos" (RN0015) e "Usuário bloqueado" (RN0018) continuam sendo decididas e emitidas pelo **nosso** backend, nunca repassando mensagens de erro brutas do Clerk ao usuário — o Clerk pode retornar mensagens em inglês ou detalhadas ("no matching user", "incorrect password") que, se exibidas diretamente, violariam RN0015 (não revelar se o login existe).

**Validações obrigatórias:**
| # | Validação | Mensagem de erro | Ação do sistema |
|---|-----------|-------------------|-------------------|
| 1 | Qualquer erro retornado pelo Clerk (login inexistente na Clerk, senha incorreta) | "Login ou senha inválidos" | Traduzir/normalizar — nunca repassar o erro literal do Clerk |
| 2 | `usuario.bloqueado = TRUE` no banco próprio | "Usuário bloqueado" | Idem — decidido antes de envolver o Clerk (RN0012-rev) |

---

## RN0102-rev — Auditoria (`historico_operacao`) permanece 100% em banco próprio

**Domínio:** Auditoria
**Módulo SGO:** UC01.02, UC01.05

**Descrição:**
Nenhuma alteração: `historico_operacao` continua sendo tabela append-only em nosso banco (RNF0006), alimentada por eventos do nosso backend, não pelo Clerk. Campos como `ip_estacao`, `uid_sessao`, `data_hora_evento` são obtidos no nosso Server Action/Route Handler, não no Clerk.

**Nota de rastreabilidade:** `sessao_usuario.uid_sessao` (dicionário original) é substituído, na prática, pelo **session ID do Clerk** (`clerk_session_id`) como identificador de sessão referenciado em `historico_operacao`. A tabela `sessao_usuario` própria deixa de ser necessária para controle de sessão ativa/expirada (o Clerk já resolve isso) — mantemos, se necessário, apenas para o caso de uso "Acesso simultâneo" (RN abaixo).

---

## RN-NOVO-01 — Acesso simultâneo (A2 — UC01.02) sob Clerk

**Domínio:** Segurança
**Módulo SGO:** UC01.02

**Descrição:**
Detectar sessão ativa anterior do mesmo usuário passa a depender da API de sessões do Clerk (`clerkClient.sessions.getSessionList({ userId })`) em vez de uma tabela `sessao_usuario` própria.

**Validações obrigatórias:**
| # | Validação | Mensagem de erro | Ação do sistema |
|---|-----------|-------------------|-------------------|
| 1 | Usuário já possui sessão ATIVA no Clerk ao autenticar novamente | — | Revogar a sessão anterior via Clerk (`sessions.revokeSession`), registrar `ACESSO_SIMULTANEO` em `historico_operacao`, prosseguir com a nova sessão |

**Gap aberto:** confirmar com o PO se o plano gratuito do Clerk oferece revogação de sessão via API (pode ser limitação de plano — precisa validação técnica antes de prometer este comportamento).

---

## RN-NOVO-02 — `flag_manutencao` e papel de Administrador

**Domínio:** Autenticação
**Módulo SGO:** UC01.02

**Descrição:**
Como o Clerk não tem conceito de "manutenção do sistema", `flag_manutencao` continua sendo um parâmetro do nosso banco. O papel "Administrador" (necessário para a exceção de RN0023) é lido dos **metadados públicos/privados do usuário no Clerk** (`publicMetadata.role` ou `privateMetadata.role`), verificado no nosso Server Action antes de aplicar a regra.

**Validações obrigatórias:**
| # | Validação | Mensagem de erro | Ação do sistema |
|---|-----------|-------------------|-------------------|
| 1 | `flag_manutencao = TRUE` e `role !== 'ADMIN'` (metadado Clerk) | "Sistema está em manutenção" | Bloquear antes de chamar o Clerk |
| 2 | `flag_manutencao = TRUE` e `role === 'ADMIN'` | — | Prosseguir normalmente |

---

## Impacto no Dicionário de Dados (DC_EP084_24)

| Campo original | Situação |
|---|---|
| `usuario.senha_hash` | **Removido** — senha vive no Clerk |
| `usuario.id` (BIGSERIAL) | Mantido, mas adiciona-se `usuario.clerk_user_id` (VARCHAR, único, NOT NULL) como FK lógica para o Clerk |
| `usuario.nome_completo`, `email` | Mantidos no banco próprio para consultas locais (relatórios, joins), mas o Clerk é a fonte de verdade para autenticação — sincronizar via webhook do Clerk (`user.created`, `user.updated`) |
| `usuario.status`, `bloqueado`, `contador_falhas`, `trocar_senha_obrigatoria` | Mantidos sem alteração de tipo/regra |
| `sessao_usuario` (tabela inteira) | **Opcional/reduzida** — Clerk gerencia sessão; avaliar se ainda é necessária ou se vira apenas espelho para o caso de uso de acesso simultâneo |
| `historico_operacao` | Mantida sem alteração |

**Gap aberto (novo):** confirmar se `trocar_senha_obrigatoria` (A2 — troca de senha obrigatória) é viável com Clerk no plano gratuito, já que a geração de senha temporária e a obrigatoriedade de troca no primeiro login são fluxos customizados que o Clerk pode ou não suportar nativamente — precisa validação técnica antes de comprometer o critério de aceite CA-01.01.15/16.
