## [US-204] — Acesso Inicial do Usuário (envio de e-mail ADIADO)

**Módulo:** Administração — Operadores e Permissões
**Épico:** EP085/24 — Módulo de Administração
**Caso de uso:** UC02.12 — Cadastrar Usuários (implementa UC02.18 — Gerar Senha de Usuário)
**Prioridade:** Alta (fatia reduzida) · Média (fatia adiada)
**Estimativa:** P

**Como** Administrador do SGO,
**Quero** que, ao cadastrar um usuário, o sistema registre que a conta ainda não tem senha definida e que eu nunca defina a senha manualmente,
**Para** manter o controle de acesso auditável (RN0050, RN0059) enquanto o disparo automático de e-mail não está em escopo.

### Contexto e Regras de Negócio

**Decisão 2026-09-07:** o Clerk continua sendo o provedor de identidade, mas o **envio automático de e-mail / convite fica adiado**. Consequência para o UC02.18:

- **Fatia reduzida (nesta fase — entra com a US-201):** ao concluir o cadastro, o sistema define `Usuario.situacaoAcesso = CONVITE_PENDENTE` e grava `HistoricoOperacao` (`USUARIO_ACESSO_GERADO`, RN0050). O Administrador comunica a senha inicial ao usuário por um canal externo; a **redefinição/reset** de senha é feita pela US de alteração (UC02.13), não aqui. Nenhuma senha é gerada, exibida ou logada pelo SGO (RN0059).
- **Fatia adiada (fora de escopo agora):** disparo do e-mail de convite pelo Clerk, estados `CONVITE_ENVIADO` / `FALHA_ENVIO_CONVITE`, ação [Reenviar convite] e `ReenviarConviteUsuarioUseCase`. Reabrir quando o envio de e-mail entrar no backlog.

Política de senha (RN0039) permanece responsabilidade do Clerk (configuração no dashboard) e é aplicada quando o usuário efetivamente definir a senha.

### Critérios de Aceite — fatia reduzida

**Cenário 1 — Cadastro registra situação de acesso e auditoria**
```gherkin
Dado que o cadastro do usuário "João da Silva" foi concluído (US-201)
Então o registro Usuario fica com situacaoAcesso = CONVITE_PENDENTE
  E o HistoricoOperacao registra tipoOperacao=USUARIO_ACESSO_GERADO, descricao "Gerou o acesso inicial do usuário [João da Silva]" (RN0050)
  E nenhuma senha em texto plano é exibida ao Administrador ou gravada em log
```

**Cenário 2 — Administrador nunca informa senha (RN0059)**
```gherkin
Dado que o Administrador está na tela de cadastro de usuário
Então não existe campo "Senha" nem "Confirmar Senha" no formulário
  E não há ação que permita ao Administrador digitar a senha do usuário
```

**Cenário 3 — Situação de acesso visível na listagem**
```gherkin
Dado que existem usuários com situacaoAcesso = CONVITE_PENDENTE e = ACESSO_ATIVO
Quando o Administrador abre [UC02.11 — Manter Usuários]
Então a coluna "Situação de acesso" exibe o valor de cada usuário com badge
```

**Cenário 4 — Promoção a ACESSO_ATIVO no primeiro login**
```gherkin
Dado que o usuário "João da Silva" está com situacaoAcesso = CONVITE_PENDENTE
Quando ele autentica pela primeira vez (evento session.created / user.updated do Clerk)
Então o webhook atualiza situacaoAcesso para ACESSO_ATIVO
```

### Critérios de Aceite — fatia adiada (não implementar agora)

- Disparo do e-mail de convite no cadastro; estados `CONVITE_ENVIADO` / `FALHA_ENVIO_CONVITE`.
- Ação [Reenviar convite] e bloqueio para `ACESSO_ATIVO`.
- Rejeição de senha fraca pelo Clerk no link de definição.

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Serviço externo | Clerk — `IdentidadeUsuarioService.criarIdentidade` (sem e-mail). `reenviarConvite` NÃO existe nesta fase |
| Tabelas afetadas | `Usuario.situacaoAcesso` (dentro da `$transaction` de US-201), `HistoricoOperacao` (INSERT) |
| Transação? | Sim — parte da `$transaction` de `CriarUsuarioUseCase` (US-201) |
| Segurança | nenhuma senha gerada/transportada/logada; sem campo de senha na UI (RN0059) |
| Auditoria | RN0050 — `USUARIO_ACESSO_GERADO` no cadastro |
| Webhook | `session.created` / `user.updated` promove `situacaoAcesso` → `ACESSO_ATIVO` (`app/api/webhooks/clerk/route.ts`) |
| Camadas | `GerarAcessoInicialUsuarioUseCase` em `application/use-cases/administracao/` (fatia reduzida). `ReenviarConviteUsuarioUseCase` e `actions/convite.ts` ficam como stub que lança "adiado" |
| Componente | `BadgeSituacaoAcesso.tsx` |

### Dependências

- **Fundação UC02.12** — `SituacaoAcessoUsuario`, porta `IdentidadeUsuarioService`, stub de `GerarAcessoInicialUsuarioUseCase`, enum `USUARIO_ACESSO_GERADO`
- [[US-201]] — a fatia reduzida roda dentro da transação de cadastro
- Fatia adiada: depende de decisão futura sobre provedor de e-mail

### Definition of Done — fatia reduzida

- [ ] Cenários 1 a 4 aprovados em homologação
- [ ] Nenhum ponto do código gera, exibe ou loga senha em texto plano
- [ ] Formulário de cadastro sem campo de senha
- [ ] `situacaoAcesso` refletida na listagem UC02.11 com badge
- [ ] Webhook promove `situacaoAcesso` a `ACESSO_ATIVO` no 1º acesso
- [ ] `USUARIO_ACESSO_GERADO` gravado no cadastro
- [ ] Teste unitário de `GerarAcessoInicialUsuarioUseCase`
- [ ] `ReenviarConviteUsuarioUseCase` documentado como adiado (stub que lança erro explícito)
