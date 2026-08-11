## [US-130] — Importar Estrutura Organizacional (Organograma) de outra Proposta

**Módulo:** Cadastros — Empregados / Estrutura Funcional
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** M

**Como** Orçamentista ou Gestor de RH (GRH),
**Quero** importar o organograma (árvore de `UnidadeFuncional`) já cadastrado em uma Proposta existente para dentro de uma nova Proposta (Contrato ou Termo de Parceria),
**Para** não precisar recriar manualmente, unidade por unidade, uma estrutura organizacional que já existe em outra Proposta equivalente ou anterior.

### Contexto e Regras de Negócio

Hoje (US-106, `docs/US-106 - Estrutura Funcional.pt-BR.md`) cada Proposta tem seu próprio organograma (`UnidadeFuncional`, escopado por `Proposta` inteira — não por Versão), cadastrado do zero via `CriarUnidadeFuncionalUseCase`. Não existe nenhum mecanismo de reaproveitamento entre Propostas diferentes: nem `DuplicarPropostaUseCase` (US-104) copia o organograma — ele duplica apenas `ValorOrcadoConta` e `RateioImpostoGrade` da Proposta origem para uma Proposta nova criada do zero.

Esta US cobre um caso diferente do de `DuplicarPropostaUseCase`: a Proposta **destino já existe** (foi criada normalmente via US-102, com ou sem organograma próprio) e o usuário quer trazer para dentro dela a árvore de uma Proposta **origem** diferente, sob demanda, a qualquer momento enquanto a destino estiver editável.

4 decisões de negócio foram tomadas com o usuário para fechar o desenho (2026-08-11):

1. **Cópia congelada, não vínculo vivo.** A importação cria unidades novas e independentes na Proposta destino (mesmo padrão de `DuplicarPropostaUseCase`: os registros copiados não referenciam os originais). Editar, renomear ou inativar uma unidade na Proposta origem **depois** da importação não tem nenhum efeito sobre a Proposta destino.
2. **Sem restrição por `tipo` de Proposta.** É permitido importar de uma Proposta `CONTRATO` para uma `TERMO_DE_PARCERIA` e vice-versa — organograma é conceitualmente igual nos dois tipos, e não há hoje nenhuma regra de negócio que os diferencie nesse aspecto.
3. **Substituir tudo, não mesclar.** Se a Proposta destino já tiver alguma `UnidadeFuncional` cadastrada (organograma parcial ou completo), a importação **inativa** as unidades existentes e insere a árvore importada no lugar. Não há tentativa de mesclar ou deduplicar por nome.
4. **Escopo de `UnidadeFuncional` confirmado como por `Proposta` inteira** (não por Versão) — decisão que também fecha a nota técnica em aberto deixada pela US-106 original. Sem migration de escopo necessária para esta US.

**Ponto que esta US precisa resolver e que não foi coberto pelas 4 decisões acima — conflito entre "substituir tudo" e a trava de inativação existente:** `InativarUnidadeFuncionalUseCase` (US-106, RN_EST_04) **bloqueia** a inativação de uma unidade que tenha `CargoAlocacaoPercentual` vinculado. Se a Proposta destino já tiver Cargos rateados nas unidades existentes, "substituir tudo" colidiria com essa trava. Ver Cenário 4 abaixo — a importação deve **bloquear com erro explícito** nesse caso (mesma filosofia "Trava o Erro" do restante do sistema), não silenciar a trava nem forçar a inativação por baixo dela.

**Correção 2026-08-11 (mesma sessão do refinamento)**: esta US foi originalmente refinada assumindo que a UI de Estrutura Funcional (US-116) ainda não existia — premissa errada. **US-116/US-117 já estão implementadas em produção desde 2026-08-08** (`/propostas/{id}/estrutura`, `EstruturaFuncionalPanel.tsx`/`OrganogramaPanel.tsx`/`CargoPanel.tsx`), o item só ficou fora do backlog Kanban por engano. Não há mais dependência de sequenciamento a esperar — a ação "Importar de outra Proposta" é um botão/fluxo novo dentro dessa tela já existente. O desenho técnico da [ADR-041](ADR-041%20-%20Sequenciamento%20US-116-US-130%20e%20Remapeamento%20de%20Hierarquia.pt-BR.md) (remapeamento de hierarquia self-relation, trava de Cargo vinculado em lote) continua válido — só a premissa de sequenciamento mudou.

### Critérios de Aceite

**Cenário 1 — Importação bem-sucedida para Proposta destino sem organograma prévio**
```gherkin
Dado que a Proposta A (origem) tem um organograma completo: 1 Diretoria com 2 Assessorias filhas
E a Proposta B (destino) está em status RASCUNHO ou EM_ELABORACAO, sem nenhuma UnidadeFuncional cadastrada
E o usuário está autenticado com perfil de escrita no módulo de Empregados na Proposta B
Quando ele seleciona a Proposta A como origem e confirma a importação
Então o sistema cria na Proposta B uma cópia independente da árvore: 1 Diretoria + 2 Assessorias, preservando a hierarquia (idPai remapeado para os novos IDs)
E os nomes e tipoNivel das unidades copiadas são idênticos aos da origem
E o log de auditoria é gravado com: ator, data, propostaOrigemId, propostaDestinoId, quantidade de unidades importadas
```

**Cenário 2 — Importação substitui organograma parcial já existente na destino**
```gherkin
Dado que a Proposta B (destino) já tem 1 unidade Sintética "Gerência Financeira" cadastrada, sem nenhum Cargo vinculado a ela
Quando o usuário importa o organograma da Proposta A
Então a unidade "Gerência Financeira" (e qualquer outra unidade pré-existente na destino) é inativada
E a árvore importada da Proposta A é inserida como as únicas unidades ativas da Proposta B
E o log de auditoria registra tanto a inativação das unidades antigas quanto a criação das novas, na mesma operação
```

**Cenário 3 — Edição da origem depois da importação não propaga para a destino [cópia congelada]**
```gherkin
Dado que a importação da Proposta A para a Proposta B já foi concluída
Quando o usuário renomeia uma unidade na Proposta A (origem) ou inativa uma unidade lá
Então a unidade correspondente já copiada na Proposta B permanece inalterada, com o nome e status que tinha no momento da importação
```

**Cenário 4 — Importação bloqueada quando a destino tem Cargo vinculado ao organograma existente [TRAVA O ERRO]**
```gherkin
Dado que a Proposta B (destino) já tem uma unidade Analítica "Setor de Compras" com pelo menos 1 CargoAlocacaoPercentual vinculado a ela
Quando o usuário tenta importar o organograma de outra Proposta para dentro da Proposta B
Então o sistema bloqueia a operação inteira antes de qualquer escrita, com mensagem explícita informando quais unidades têm Cargo vinculado e impedem a substituição
E nenhuma unidade é criada, inativada ou alterada em nenhuma das duas Propostas
E nenhum log de auditoria de importação é gravado (a operação não chegou a ocorrer)
```

**Cenário 5 — Importação permitida entre tipos de Proposta diferentes**
```gherkin
Dado que a Proposta A (origem) é do tipo CONTRATO
E a Proposta B (destino) é do tipo TERMO_DE_PARCERIA
Quando o usuário importa o organograma de A para B
Então a importação ocorre normalmente, sem nenhuma restrição relacionada a tipo de Proposta
```

**Cenário 6 — Bloqueio por status de Proposta destino não editável [TRAVA O ERRO]**
```gherkin
Dado que a Proposta B (destino) está em status OFICIALIZADO ou ENCERRADO
Quando o usuário tenta importar um organograma para dentro dela
Então o sistema bloqueia a operação com mensagem informando que a Proposta destino não está em edição
E nenhum dado é alterado
```

**Cenário 7 — Origem sem organograma cadastrado**
```gherkin
Dado que a Proposta A (origem) não tem nenhuma UnidadeFuncional ativa cadastrada
Quando o usuário tenta importar o organograma de A para qualquer Proposta destino
Então o sistema bloqueia com mensagem informando que a Proposta origem não tem estrutura organizacional para importar
E nenhum dado é alterado
```

### Impacto Técnico (orientação para dev)

| Aspecto           | Detalhe                                                  |
|-------------------|------------------------------------------------------------|
| Tabelas afetadas  | `UnidadeFuncional` (leitura na origem, escrita — create + inativação — na destino) |
| Novo Use Case     | `ImportarEstruturaOrganizacionalUseCase` — não é extensão de `DuplicarPropostaUseCase` (esse cria Proposta nova do zero; este importa para Proposta destino já existente) |
| Padrão de remapeamento | Desenhado em ADR-041 — 2 passos determinísticos (Sintéticas primeiro com `Map<idOrigem, idNovoDestino>`, depois Analíticas resolvendo `idPai` pelo map), aproveitando que a árvore é sempre 2 níveis fixos (ADR-015), sem necessidade de recursão genérica |
| Trava de Cargo vinculado (lote) | Checagem read-only nova antes da transação (`findMany` de unidades ativas da destino com `alocacoesCargo: { some: {} }`) — não reaproveita `InativarUnidadeFuncionalUseCase` diretamente (é por-unidade). Erro dedicado listando as unidades bloqueadoras (ver ADR-041) |
| Transação?        | Sim — toda a operação (validação de Cargo vinculado + inativação das unidades antigas da destino + criação da árvore nova) em uma única `$transaction`, atômica |
| Requer lock?      | Não — sem concorrência de saldo; mas a validação de `CargoAlocacaoPercentual` vinculado deve ocorrer dentro da mesma transação para evitar corrida com um cadastro de Cargo concorrente |
| Auditoria         | Registrar em `HistoricoOperacao`: tenantId, usuarioId, propostaOrigemId, propostaDestinoId, quantidade de unidades inativadas + quantidade de unidades criadas |
| Regra de negócio  | RN_EST_04 (já existente, US-106) reaproveitada como trava de bloqueio total da importação, não como bloqueio unidade-a-unidade — ver Cenário 4 |
| Validação de status | Reaproveita a mesma checagem de RASCUNHO/EM_ELABORACAO já usada por `CriarUnidadeFuncionalUseCase` (US-106), aplicada à Proposta **destino** |

### Dependências

- **US-106** (`UnidadeFuncional`, RN_EST_04) — base de dados e trava de Cargo vinculado reaproveitada
- **US-116** (Gerenciar Estrutura Funcional — UI, ainda não implementada) — esta US depende de existir uma tela onde o botão/fluxo de importação seja exposto; avaliar com o Tech Lead se entram no mesmo PR ou em sequência
- **US-107/US-107a** (`Cargo`, `CargoAlocacaoPercentual`) — necessárias para o Cenário 4 (trava por vínculo de Cargo) fazer sentido; já implementadas

### Definition of Done

- [ ] Cenários 1 a 7 implementados e aprovados em homologação
- [ ] Remapeamento de hierarquia (idPai) verificado com árvore de 2 níveis completos (Sintético + Analítico)
- [ ] Importação é atômica — falha em qualquer ponto não deixa a Proposta destino com organograma parcialmente substituído
- [ ] Trava de Cargo vinculado (Cenário 4) testada com mensagem explícita listando as unidades bloqueadoras
- [ ] Importação testada entre Propostas de tipos diferentes (Contrato ↔ Termo de Parceria)
- [ ] Log de auditoria gravado com contagem de unidades inativadas e criadas
- [ ] Operação testada com usuário sem permissão (deve bloquear)
- [ ] Operação bloqueada corretamente quando a Proposta destino está Oficializada/Encerrada
- [ ] Nota técnica da US-106 sobre escopo Proposta vs. Versão fechada e propagada ao arquivo original (feito nesta sessão)

### Observação para avisos de validação externa

Assim como US-128/US-129 (Premissas e Reajustes), esta US não tem CA assinado por Rafael Guerra/GIA ou validado por André/SCOR — é uma demanda levantada diretamente pelo usuário nesta sessão, fora do fluxo formal de CA vindos de fora. Não há divergência a avisar (não existe CA prévio para esta US), mas vale registrar a mesma prática de manter rastreabilidade caso um CA formal apareça depois cobrindo o mesmo escopo.
