## [US-201] — Cadastrar Usuário (dados de conta)

**Módulo:** Administração — Operadores e Permissões
**Épico:** EP085/24 — Módulo de Administração
**Caso de uso:** UC02.12 — Cadastrar Usuários
**Prioridade:** Alta
**Estimativa:** G

**Como** Administrador do SGO,
**Quero** cadastrar um novo usuário informando nome completo, e-mail, login e status,
**Para** conceder acesso ao sistema a um novo operador, com a garantia de que a conta é criada de forma consistente entre o SGO e o provedor de identidade (Clerk) e sem que eu defina manualmente a senha.

### Contexto e Regras de Negócio

Cobre o núcleo do UC02.12. O cadastro só é concluído quando **três efeitos ocorrem de forma atômica**:

1. criação da **identidade no Clerk sem envio de e-mail** (`IdentidadeUsuarioService.criarIdentidade` → `users.createUser({ skipPasswordRequirement: true })`);
2. persistência do registro `Usuario` local vinculado ao `clerkUserId`;
3. registro em `HistoricoOperacao` (UC02.22, `TipoOperacao = USUARIO_CRIADO`).

A associação de perfis é **obrigatória** (RN0079) e detalhada em [[US-202]]; as exceções de acesso em [[US-203]]. Este fluxo não permite salvar sem ao menos um perfil.

**Decisão 2026-09-07 — sem disparo de e-mail nesta fase.** O Clerk continua sendo o provedor de identidade e o usuário passa a conseguir autenticar após o cadastro, mas o convite/e-mail de definição de senha **não é enviado**. A senha inicial é comunicada/resetada manualmente pelo Administrador (via UC02.13 — fora do escopo desta US). O usuário nasce com `situacaoAcesso = CONVITE_PENDENTE` (identidade criada, senha inicial ainda não comunicada). Ver [[US-204]].

**Ordem de resiliência (compensação):** a chamada ao Clerk ocorre **antes** do commit local. Se o Clerk falhar, nada é persistido. Se a persistência local (ou o log) falhar **após** o Clerk criar a identidade, a identidade é removida (`IdentidadeUsuarioService.excluirIdentidade`) — não pode restar conta órfã em nenhum dos lados.

Regras aplicáveis: RN0065 (login único), RN0066 (login imutável após cadastro — enforçado na US de alteração), REQ0074 (nome, login, e-mail, status obrigatórios), RN0059 (Administrador não digita senha), RNF0004/EP085 + RN0022/EP083 (autorização RBAC revalidada no backend — ver [[US-205]]).

Notas de aderência ao schema atual (`prisma/schema.prisma`):
- `Usuario` hoje não possui `login` — **a migration da fundação adiciona `login String @unique`**.
- `Usuario` recebe `situacaoAcesso SituacaoAcessoUsuario @default(CONVITE_PENDENTE)`.
- `tenantId` do Administrador executor é aplicado ao novo `Usuario` (hoje `getTenantId()` retorna `'default'` — single-tenant provisório).

### Critérios de Aceite

**Cenário 1 — Cadastro válido cria identidade no Clerk e registro local**
```gherkin
Dado que o usuário autenticado possui perfil "Administrador" no tenant corrente
  E não existe usuário com login "j.silva" nem com e-mail "j.silva@fsg.org.br"
Quando ele preenche Nome Completo="João da Silva", E-mail="j.silva@fsg.org.br", Login="j.silva", Status="Ativo"
  E seleciona ao menos um Perfil de Acesso (conforme US-202)
  E clica em [Salvar]
Então o sistema cria a identidade no Clerk SEM enviar e-mail
  E persiste um registro em Usuario com clerkUserId, tenantId, nomeCompleto, email, login, status=ATIVO, situacaoAcesso=CONVITE_PENDENTE
  E persiste as associações de perfil na mesma transação (US-202)
  E grava em HistoricoOperacao: tipoOperacao=USUARIO_CRIADO, usuarioId (executor), dataHoraEvento, descricao "Cadastrou o usuário [João da Silva]", ipEstacao, clerkSessionId, dadosSerializados com a capa criada (sem segredo)
  E exibe "Usuário cadastrado com sucesso. A senha inicial deve ser comunicada ao usuário pelo Administrador."
  E retorna para a listagem [UC02.11 — Manter Usuários]
```

**Cenário 2 — Campo obrigatório em branco [TRAVA O ERRO]**
```gherkin
Dado que o Administrador está preenchendo o formulário de novo usuário
Quando ele deixa qualquer um dos campos Nome Completo, E-mail, Login ou Status em branco
  E tenta salvar
Então o sistema bloqueia a persistência e não cria nada (nem no Clerk, nem local)
  E exibe "Os campos Nome Completo, E-mail, Login e Status são obrigatórios."
  E o formulário permanece aberto com os dados já digitados intactos
```

**Cenário 3 — Login já existente [TRAVA O ERRO] (RN0065)**
```gherkin
Dado que já existe um usuário com login "j.silva" no tenant
Quando o Administrador informa Login="j.silva" e tenta salvar
Então o sistema bloqueia a operação
  E exibe "O login informado já está em uso. Escolha outro login."
  E nenhum registro é criado no Clerk nem no banco local
```

**Cenário 4 — E-mail já existente [TRAVA O ERRO]**
```gherkin
Dado que já existe um usuário (local ou no Clerk) com e-mail "j.silva@fsg.org.br"
Quando o Administrador tenta salvar com esse e-mail
Então o sistema bloqueia a operação
  E exibe "O e-mail informado já está associado a outro usuário."
  E nenhum registro é criado
```

**Cenário 5 — E-mail em formato inválido [TRAVA O ERRO]**
```gherkin
Dado que o Administrador informa E-mail="joao#fsg"
Quando tenta salvar
Então o sistema exibe "Informe um e-mail válido."
  E a operação é bloqueada
```

**Cenário 6 — Falha na criação da identidade no Clerk aborta o cadastro**
```gherkin
Dado que os dados do formulário são válidos
Quando a chamada users.createUser no Clerk falha (erro de rede ou rejeição da API)
Então nenhum registro Usuario é persistido localmente
  E o sistema exibe "Não foi possível criar a conta de acesso no momento. Tente novamente."
  E a exceção é registrada (console.error / SysLog — UC02.21)
```

**Cenário 7 — Falha na persistência local após criar a identidade no Clerk (compensação)**
```gherkin
Dado que a identidade no Clerk foi criada com sucesso
Quando a gravação do registro Usuario, das associações de perfil ou do HistoricoOperacao falha
Então o sistema exclui a identidade recém-criada no Clerk (rollback compensatório)
  E não deixa registro parcial em nenhum dos lados
  E exibe "Falha ao concluir o cadastro. Nenhuma conta foi criada."
```

**Cenário 8 — Cancelar cadastro (Fluxo Alternativo A1)**
```gherkin
Dado que o Administrador preencheu parte do formulário
Quando clica em [Cancelar]
Então o sistema descarta os dados preenchidos sem criar nada
  E retorna para a listagem [UC02.11 — Manter Usuários]
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `Usuario` (INSERT), `UsuarioPerfil` (INSERT — via US-202), `UsuarioPerfilExcecao` (INSERT — via US-203), `HistoricoOperacao` (INSERT) |
| Serviço externo | Clerk — `IdentidadeUsuarioService.criarIdentidade` / `.excluirIdentidade` (porta em `src/application/ports/IdentidadeUsuarioService.ts`). **Sem invitations / sem e-mail** nesta fase |
| Transação? | Sim — `prisma.$transaction`: `Usuario` + `UsuarioPerfil` + `UsuarioPerfilExcecao` + `HistoricoOperacao`. Chamada ao Clerk **antes** do commit; falha no commit ⇒ `excluirIdentidade` (compensação) |
| Requer lock? | Não — INSERT. Unicidade de `login` e `email` por constraint UNIQUE + verificação prévia para mensagem amigável (`isUniqueConstraintError` como rede de segurança) |
| Multi-tenant | `tenantId` de `getTenantId()` aplicado ao `Usuario` e a cada `UsuarioPerfil` |
| Auditoria | `HistoricoOperacao`: tenantId, usuarioId (executor), tipoOperacao=USUARIO_CRIADO, descricao, ipEstacao, clerkSessionId, dadosSerializados (capa, sem senha) |
| Camadas | `CriarUsuarioUseCase` (`application/use-cases/administracao/`) orquestra e abre a `$transaction`, chamando `AssociarPerfisUsuarioUseCase` (US-202) e `DefinirExcecoesAcessoUsuarioUseCase` (US-203) com o `tx`. Action `criarUsuario` em `app/(autenticado)/administracao/usuarios/actions/criar.ts` |
| Regra de negócio | RN0065, REQ0074, RN0059, RN0079 (≥ 1 perfil, validado no backend) |

### Dependências

- **Fundação UC02.12** (mergeada, PR #22 + ajuste "sem convite"): schema/migration (`login`, `situacaoAcesso`, enums de `TipoOperacao`), stubs de use-case, porta `IdentidadeUsuarioService`, `guardAdministrador()`, scaffold da rota
- [[US-202]] — associação de perfil (mesma tela; salvar exige ≥ 1 perfil)
- [[US-204]] — fatia reduzida: só define `situacaoAcesso = CONVITE_PENDENTE` + auditoria (envio de e-mail adiado)
- [[US-205]] — `guardAdministrador()` já protege a action

### Definition of Done

- [ ] Cenários 1 a 8 implementados e aprovados em homologação
- [ ] Conta nunca fica órfã: testado com falha simulada no Clerk (Cenário 6) e com falha simulada na persistência local (Cenário 7 — `excluirIdentidade` chamado)
- [ ] `login` e `email` com constraint UNIQUE no schema + verificação prévia com mensagem amigável
- [ ] Administrador nunca vê campo de senha (RN0059) — inspeção da UI
- [ ] Log de auditoria gravado no cenário de sucesso com todos os campos obrigatórios
- [ ] Bloqueio validado no backend, não só na UI (cobertura conjunta com US-205)
- [ ] Teste unitário do `CriarUsuarioUseCase` cobrindo a compensação
