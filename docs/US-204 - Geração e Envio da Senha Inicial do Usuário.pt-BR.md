## [US-204] — Geração e Envio da Senha Inicial do Usuário

**Módulo:** Administração — Operadores e Permissões
**Épico:** EP085/24 — Módulo de Administração
**Caso de uso:** UC02.12 — Cadastrar Usuários (implementa UC02.18 — Gerar Senha de Usuário)
**Prioridade:** Alta
**Estimativa:** P

**Como** Administrador do SGO,
**Quero** que o sistema gere e envie automaticamente o acesso inicial ao novo usuário por e-mail,
**Para** que ele defina a própria senha no primeiro acesso, sem que eu tenha visibilidade ou controle sobre a senha (RN0059, RN0071, RN0039).

### Contexto e Regras de Negócio

O UC02.18 original ("Gerar Senha de Usuário") é atendido pelo **fluxo de convite do provedor de identidade (Clerk)**: o SGO **não gera** string de senha nem a persiste (CLAUDE.md — "Autenticação: Clerk... sem lógica customizada de senha/bloqueio além do que o Clerk já oferece"). O Clerk envia o e-mail de convite; o usuário define a senha atendendo à política configurada no Clerk (cobre RN0039). Esta US formaliza o comportamento, o tratamento de falha de envio e o reenvio.

`Usuario.situacaoAcesso` (`SituacaoAcessoUsuario`, criado na fundação) reflete o estado: `CONVITE_PENDENTE` → `CONVITE_ENVIADO` → `ACESSO_ATIVO` (após 1º login, via webhook `session.created`/`user.updated`), ou `FALHA_ENVIO_CONVITE`.

Pendência a resolver na fundação: confirmar a API de convite disponível no plano gratuito do Clerk. Alternativa registrada: `users.createUser({ skipPasswordRequirement: true })` + disparo de e-mail de reset. A porta `ConviteIdentidadeService` isola a decisão.

### Critérios de Aceite

**Cenário 1 — Convite enviado no cadastro (fluxo feliz)**
```gherkin
Dado que o cadastro do usuário "João da Silva" foi concluído (US-201)
Então o provedor de identidade envia um e-mail de convite para "j.silva@fsg.org.br" com link de definição de senha
  E o registro Usuario fica com situacaoAcesso=CONVITE_ENVIADO
  E o HistoricoOperacao registra tipoOperacao=USUARIO_ACESSO_GERADO, descricao "Gerou o acesso inicial do usuário [João da Silva]" (RN0050)
  E nenhuma senha em texto plano é exibida ao Administrador ou gravada em log
```

**Cenário 2 — Administrador nunca informa senha (RN0059)**
```gherkin
Dado que o Administrador está na tela de cadastro de usuário
Então não existe campo "Senha" nem "Confirmar Senha" no formulário
  E não há ação que permita ao Administrador digitar a senha do usuário
```

**Cenário 3 — Falha no envio do e-mail de convite**
```gherkin
Dado que a identidade foi criada no Clerk mas o envio do e-mail retornou falha
Então o registro Usuario fica com situacaoAcesso=FALHA_ENVIO_CONVITE
  E a listagem [UC02.11] exibe essa situação com o badge correspondente
  E o Administrador dispõe da ação [Reenviar convite]
  E a exceção é registrada (console.error / SysLog — UC02.21)
```
> Observação: falha **apenas** no e-mail (identidade já criada) NÃO dispara a compensação da US-201 — o cadastro é considerado concluído com situação degradada e recuperável via reenvio.

**Cenário 4 — Reenviar convite**
```gherkin
Dado que o usuário está com situacaoAcesso=FALHA_ENVIO_CONVITE ou CONVITE_ENVIADO e ainda não fez o 1º acesso
Quando o Administrador aciona [Reenviar convite] na listagem
Então o provedor emite um novo convite para o mesmo e-mail e invalida o anterior
  E situacaoAcesso volta a CONVITE_ENVIADO
  E o HistoricoOperacao registra tipoOperacao=USUARIO_CONVITE_REENVIADO
```

**Cenário 5 — Reenvio bloqueado para usuário que já acessou**
```gherkin
Dado que o usuário está com situacaoAcesso=ACESSO_ATIVO
Quando o Administrador tenta [Reenviar convite]
Então o sistema não reenvia e exibe "Este usuário já realizou o primeiro acesso."
```

**Cenário 6 — Critérios de segurança da senha (RN0039)**
```gherkin
Dado que o usuário convidado acessa o link e define a senha
Quando informa uma senha que não atende à política configurada no Clerk
Então o Clerk rejeita e exibe os requisitos não atendidos
  E a conta permanece com situacaoAcesso=CONVITE_ENVIADO
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Serviço externo | Clerk — `ConviteIdentidadeService.criarConvite` / `.reenviarConvite`. Política de senha no dashboard do Clerk (atende RN0039) |
| Tabelas afetadas | `Usuario.situacaoAcesso` (UPDATE), `HistoricoOperacao` (INSERT) |
| Transação? | Geração inicial: dentro da `$transaction` de US-201 (grava `situacaoAcesso` + log). Reenvio: transação curta própria |
| Segurança | nenhuma senha gerada, transportada ou logada pelo SGO; sem campo de senha na UI (RN0059) |
| Auditoria | RN0050 — `USUARIO_ACESSO_GERADO` no cadastro e `USUARIO_CONVITE_REENVIADO` a cada reenvio |
| Observabilidade | falha de convite/e-mail ⇒ `console.error`/SysLog (UC02.21) + situação visível na listagem |
| Camadas | `GerarAcessoInicialUsuarioUseCase` e `ReenviarConviteUsuarioUseCase` em `application/use-cases/administracao/`; action `reenviarConvite` em `.../usuarios/actions/convite.ts`; componente `BadgeSituacaoAcesso.tsx` |
| Webhook | `session.created` / `user.updated` promove `situacaoAcesso` a `ACESSO_ATIVO` (ajuste em `app/api/webhooks/clerk/route.ts`) |

### Dependências

- **Fundação UC02.12** — `SituacaoAcessoUsuario`, porta `ConviteIdentidadeService`, stubs dos use-cases, enums `USUARIO_ACESSO_GERADO`/`USUARIO_CONVITE_REENVIADO`
- Política de senha configurada no Clerk (item de configuração, não de código — alinhar com RN0039)
- [[US-201]] — a geração inicial roda dentro da transação de cadastro
- [[US-205]] — ação [Reenviar convite] protegida por `guardAdministrador()`

### Definition of Done

- [ ] Cenários 1 a 6 aprovados em homologação
- [ ] Nenhum ponto do código gera, exibe ou loga senha em texto plano
- [ ] Formulário de cadastro sem campo de senha
- [ ] `situacaoAcesso` refletida na listagem UC02.11 com badge
- [ ] Reenvio funcional e auditado; bloqueado para `ACESSO_ATIVO`
- [ ] Falha de envio registrada e recuperável pelo Administrador
- [ ] Webhook promove `situacaoAcesso` a `ACESSO_ATIVO` no 1º acesso
- [ ] Testes unitários de `GerarAcessoInicialUsuarioUseCase` e `ReenviarConviteUsuarioUseCase`
