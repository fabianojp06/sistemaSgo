## [US-203] — Definir Exceções de Permissão de Acesso no Cadastro

**Módulo:** Administração — Operadores e Permissões
**Épico:** EP085/24 — Módulo de Administração
**Caso de uso:** UC02.12 — Cadastrar Usuários (Fluxo Alternativo A2; implementa UC02.10 — Definir Permissão de Acesso)
**Prioridade:** Média
**Estimativa:** M

**Como** Administrador do SGO,
**Quero** desmarcar funcionalidades específicas de um perfil associado ao usuário durante o cadastro,
**Para** retirar desse usuário o acesso a itens pontuais do perfil sem precisar criar um novo perfil (REQ0080), mantendo o modelo RBAC com exceções por usuário.

### Contexto e Regras de Negócio

Implementa o Fluxo Alternativo A2 do UC02.12 e os REQ0080/REQ0081. A exceção **apenas retira** acesso — nunca concede além do que o perfil dá.

Se todas as funcionalidades de um perfil forem desmarcadas, o próprio perfil é desmarcado (REQ0081), o que reativa a trava do mínimo de 1 perfil de [[US-202]].

**Risco arquitetural (P1) — blast radius do resolver de permissão.** Esta US altera o cálculo de permissão efetiva, hoje em `usuarioTemFuncionalidade()` e `ObterMenuUsuarioUseCase` — código compartilhado com o menu e o controle de acesso de features **já em produção**. Mitigação obrigatória:

- a exceção é **aditiva por ausência**: sem linha em `UsuarioPerfilExcecao` ⇒ comportamento atual intacto (LEFT JOIN / `NOT EXISTS`);
- a fundação congela a assinatura de `resolverPermissaoEfetiva(...)` e faz `ObterMenuUsuarioUseCase` + `usuarioTemFuncionalidade` já chamarem esse helper como *passthrough*; esta US só troca o corpo;
- o PR desta US **deve** rodar e anexar o resultado de `ObterMenuUsuarioUseCase.test.ts` e dos testes de `verificarPermissao` como gate de regressão.

Modelo de resolução efetiva:
```
funcionalidades_efetivas(usuario) =
   ⋃ (funcionalidades ativas dos perfis do usuário)
   −  { (perfilId, funcionalidadeId) ∈ UsuarioPerfilExcecao do usuário }
```

Notas de aderência ao schema:
- **A migration da fundação cria `model UsuarioPerfilExcecao`** com `@@id([usuarioId, perfilId, funcionalidadeId])` e `tenantId`.
- Este use-case recebe o `tx` da transação de `CriarUsuarioUseCase` ([[US-201]]).

### Critérios de Aceite

**Cenário 1 — Criar exceção desmarcando uma funcionalidade (A2)**
```gherkin
Dado que o Administrador marcou o perfil "Orçamentista", cujas funcionalidades ativas incluem "Lançar Despesa" e "Emitir Relatório"
Quando ele clica sobre a funcionalidade "Emitir Relatório" no painel Funcionalidade(s) do Perfil
Então o sistema desmarca "Emitir Relatório"
  E ao salvar, persiste uma linha em UsuarioPerfilExcecao (usuario, perfil "Orçamentista", funcionalidade "Emitir Relatório", tenantId)
  E grava HistoricoOperacao tipoOperacao=USUARIO_PERFIL_EXCECAO_DEFINIDA descrevendo a retirada de acesso
  E o usuário criado NÃO tem "Emitir Relatório" no menu nem passa em usuarioTemFuncionalidade("...emitir-relatorio"), mesmo pertencendo ao perfil "Orçamentista"
```

**Cenário 2 — Funcionalidade não excetuada permanece acessível**
```gherkin
Dado que o usuário foi criado com exceção apenas em "Emitir Relatório" no perfil "Orçamentista"
Então "Lançar Despesa" continua no menu e usuarioTemFuncionalidade retorna true para ela
```

**Cenário 3 — Desmarcar todas as funcionalidades desmarca o perfil (REQ0081)**
```gherkin
Dado que o perfil "Consulta" tem exatamente duas funcionalidades ativas e ambas estão marcadas
Quando o Administrador desmarca as duas
Então o sistema desmarca automaticamente o perfil "Consulta" no painel Perfil de acesso do usuário
  E se "Consulta" era o único perfil, ao salvar aplica-se a trava da US-202 ("pelo menos um perfil")
```

**Cenário 4 — Reverter a exceção antes de salvar**
```gherkin
Dado que o Administrador havia desmarcado "Emitir Relatório"
Quando ele marca "Emitir Relatório" novamente
Então nenhuma linha de UsuarioPerfilExcecao é persistida para essa funcionalidade
  E o acesso segue integralmente o que o perfil define
```

**Cenário 5 — Regressão: usuário sem nenhuma exceção não muda de comportamento**
```gherkin
Dado um usuário existente sem linhas em UsuarioPerfilExcecao
Quando o menu e as verificações de permissão são recalculados após esta US
Então o resultado é idêntico ao anterior (suíte de ObterMenuUsuarioUseCase e verificarPermissao verde)
```

**Cenário 6 — Exceção não concede acesso além do perfil**
```gherkin
Dado que o payload contém uma "exceção" para uma funcionalidade que o perfil não possui
Quando a action processa
Então a linha é ignorada/rejeitada (a exceção só remove; nunca adiciona)
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `UsuarioPerfilExcecao` (INSERT), `HistoricoOperacao` (INSERT — 1 por exceção) |
| Transação? | Sim — recebe o `tx` de `CriarUsuarioUseCase` (US-201) |
| Código compartilhado alterado | `domain/.../resolverPermissaoEfetiva.ts` (corpo real); `ObterMenuUsuarioUseCase` e `usuarioTemFuncionalidade` já delegam a ele desde a fundação |
| Regra de negócio | exceção só **retira** acesso (REQ0080); desmarcar todas ⇒ desmarca o perfil (REQ0081); resolução = perfis − exceções |
| Índice | `UsuarioPerfilExcecao @@index([tenantId])` + PK composta cobre o LEFT JOIN por usuário |
| Auditoria | 1 registro `USUARIO_PERFIL_EXCECAO_DEFINIDA` por exceção criada |
| Camadas | `DefinirExcecoesAcessoUsuarioUseCase` em `application/use-cases/administracao/`; componente `PainelExcecoesPerfil.tsx` (self-contained, emite `ExcecaoInput[]`) |
| Gate de PR | rodar `npm test` de menu + permissão; anexar resultado |

### Dependências

- **Fundação UC02.12** — `model UsuarioPerfilExcecao`, assinatura de `resolverPermissaoEfetiva` congelada + delegação passthrough já feita, enum `USUARIO_PERFIL_EXCECAO_DEFINIDA`
- [[US-202]] — painel-pai de funcionalidades já renderizado e conceito de "perfil selecionado"
- [[US-201]] — dona da transação e da tela

### Definition of Done

- [ ] Cenários 1 a 6 aprovados em homologação
- [ ] Cálculo de permissão efetiva considera exceções (teste: acesso negado no menu e em `usuarioTemFuncionalidade`)
- [ ] Suíte de regressão de menu/permissão verde e anexada ao PR
- [ ] Desmarcar todas as funcionalidades desmarca o perfil
- [ ] Exceções persistidas na mesma transação do cadastro
- [ ] Auditoria por exceção
- [ ] Teste unitário de `DefinirExcecoesAcessoUsuarioUseCase` e de `resolverPermissaoEfetiva` (com e sem exceções)
