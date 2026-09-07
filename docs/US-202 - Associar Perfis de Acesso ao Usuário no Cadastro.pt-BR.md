## [US-202] — Associar Perfis de Acesso ao Usuário no Cadastro

**Módulo:** Administração — Operadores e Permissões
**Épico:** EP085/24 — Módulo de Administração
**Caso de uso:** UC02.12 — Cadastrar Usuários (implementa UC02.14 — Associar usuários ao Perfil)
**Prioridade:** Alta
**Estimativa:** M

**Como** Administrador do SGO,
**Quero** selecionar um ou mais perfis de acesso para o usuário durante o cadastro,
**Para** definir o conjunto de módulos e funcionalidades que ele poderá acessar, garantindo que nenhum usuário exista sem ao menos um perfil (RN0079).

### Contexto e Regras de Negócio

Implementa UC02.14 no contexto do cadastro ([[US-201]]). O painel "Perfil de acesso do usuário" lista todos os perfis **ativos** do tenant. Ao marcar um perfil, o painel "Funcionalidade(s) do Perfil" exibe as funcionalidades daquele perfil — base para as exceções ([[US-203]]).

Regras: RN0079 (mínimo 1 perfil), RN0083 (um usuário pode ter vários perfis), RN0056 (histórico por associação), RN0078 (só funcionalidades ativas de módulos ativos — já garantido por `ObterMenuUsuarioUseCase`/`usuarioTemFuncionalidade`). RN0040 (desconexão ao associar perfil) **não se aplica** aqui — usuário recém-criado não tem sessão ativa; RN0040 vale para a US de alteração.

Notas de aderência ao schema:
- `Perfil` hoje **não tem** `ativo` nem `descricao` — **a migration da fundação adiciona `ativo Boolean @default(true)` e `descricao String?`**.
- `UsuarioPerfil` já existe com `@@id([usuarioId, perfilId])` e `tenantId` redundante — usar como está.
- Este use-case recebe o `tx` da transação aberta em `CriarUsuarioUseCase` (US-201) — não abre transação própria.

### Critérios de Aceite

**Cenário 1 — Associação de um perfil**
```gherkin
Dado que o Administrador está na tela de cadastro de usuário com os dados de conta preenchidos
  E existem os perfis ativos "Orçamentista" e "Consulta" no tenant
Quando ele marca o perfil "Orçamentista" no painel Perfil de acesso do usuário
Então o painel Funcionalidade(s) do Perfil passa a exibir, marcadas, todas as funcionalidades ativas do perfil "Orçamentista"
  E ao salvar, o sistema persiste uma associação UsuarioPerfil (usuario, perfil "Orçamentista", tenantId)
  E grava em HistoricoOperacao tipoOperacao=USUARIO_PERFIL_ASSOCIADO, descricao "Perfil [Orçamentista] associado ao usuário [João da Silva]" (RN0056)
```

**Cenário 2 — Associação de múltiplos perfis (RN0083)**
```gherkin
Dado que o Administrador marcou "Orçamentista" e "Consulta"
Quando salva o cadastro
Então o sistema persiste duas associações UsuarioPerfil
  E grava um registro de HistoricoOperacao (USUARIO_PERFIL_ASSOCIADO) por associação
```

**Cenário 3 — Salvar sem nenhum perfil [TRAVA O ERRO] (RN0079)**
```gherkin
Dado que o Administrador preencheu os dados de conta mas não marcou nenhum perfil
Quando clica em [Salvar]
Então o sistema bloqueia a persistência (UsuarioSemPerfilError)
  E exibe "O usuário deve estar associado a pelo menos um perfil de acesso."
  E nenhuma conta é criada (nem no Clerk, nem local)
```

**Cenário 4 — Somente perfis ativos são selecionáveis**
```gherkin
Dado que existe o perfil "Auditoria Externa" com ativo=false no tenant
Quando o Administrador abre o painel Perfil de acesso do usuário
Então o perfil "Auditoria Externa" não é exibido na lista de perfis disponíveis
```

**Cenário 5 — Tentativa de associar perfil inativo via requisição direta [TRAVA O ERRO]**
```gherkin
Dado que o payload enviado ao backend contém o id de um perfil inativo ou de outro tenant
Quando a action processa a requisição
Então o sistema rejeita a operação (PerfilInativoError)
  E nenhum registro é criado
```

**Cenário 6 — Desmarcar um perfil antes de salvar**
```gherkin
Dado que o Administrador havia marcado "Orçamentista" e "Consulta"
Quando desmarca "Consulta"
Então o painel Funcionalidade(s) do Perfil deixa de exibir as funcionalidades de "Consulta"
  E ao salvar, apenas a associação com "Orçamentista" é persistida
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `UsuarioPerfil` (INSERT — 1..N linhas), `HistoricoOperacao` (INSERT — 1 por associação) |
| Transação? | Sim — recebe e usa o `tx` da `$transaction` de `CriarUsuarioUseCase` (US-201) |
| Fonte de dados | `ListarPerfisAtivosUseCase` — `Perfil` com `ativo:true` e `tenantId` do executor; painel de funcionalidades reusa a projeção de `ObterMenuUsuarioUseCase` |
| Validação backend | todo `perfilId` do payload deve existir, estar `ativo` e pertencer ao `tenantId` (Cenário 5) |
| Regra de negócio | RN0079 (≥ 1 perfil, backend), RN0083 (N perfis), RN0078 (só ativos) |
| Auditoria | descrição no formato "Perfil [nome] associado ao usuário [nome]" por associação (RN0056) |
| Camadas | `AssociarPerfisUsuarioUseCase` + `ListarPerfisAtivosUseCase` em `application/use-cases/administracao/`; action `listarPerfisAtivos` em `.../usuarios/actions/perfis.ts`; componente `PainelPerfisAcesso.tsx` (self-contained, emite `string[]` de perfilIds) |

### Dependências

- **Fundação UC02.12** — `Perfil.ativo`/`descricao`, stub de `AssociarPerfisUsuarioUseCase`, enum `USUARIO_PERFIL_ASSOCIADO`
- [[US-201]] — dona da transação e da tela; consome `PainelPerfisAcesso` via props
- Perfis cadastrados e ativos no tenant (seed já cria "Administrador" e "Gestor Master")

### Definition of Done

- [ ] Cenários 1 a 6 aprovados em homologação
- [ ] Validação de "mínimo 1 perfil" no backend (não só na UI)
- [ ] Apenas perfis ativos listados; perfil inativo/de outro tenant rejeitado no backend
- [ ] 1 registro de auditoria por perfil associado
- [ ] Associações persistidas na mesma transação da criação do usuário
- [ ] Teste unitário de `AssociarPerfisUsuarioUseCase` e `ListarPerfisAtivosUseCase`
