## [US-108a] — Elegibilidade Individual de Benefícios do Empregado

**Módulo:** Cadastros — Empregados / Benefícios
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** G

**Como** Gestor de RH (GRH),
**Quero** ativar/desativar individualmente cada benefício de um Empregado, com período de vigência e número de dependentes por benefício,
**Para** que o custo de benefícios reflita exatamente o que cada colaborador realmente usa, não o pacote inteiro do Cargo.

### Contexto e Regras de Negócio

Esta US cobre o UC03.28 (Benefícios) da Minuta V5 — a elegibilidade individual do Empregado, distinta da Tabela Mestre do Cargo (US-107a, já concluída). O usuário confirma benefício por benefício se aquele Empregado específico usa aquele auxílio, dentro do que o Cargo já disponibiliza.

Achados de qualidade documental e decisões fechadas com o usuário nesta sessão:

1. **Vale Transporte não existia em `Cargo`** (US-107a modelou só VA, VR, Saúde, Odonto, Vida, Creche — 6 benefícios; a Minuta menciona Transporte no UC03.28 mas ele nunca apareceu no bloco C do UC03.19). Decisão: **é um 7º benefício real, adicionado retroativamente ao Cargo nesta US** (retrabalho pontual em US-107a/ADR-019, não uma nova US). Segue a mesma fórmula de VA/VR (`valorUnitario × diasUteisPadrao`), e `Cargo.custoTotalCargo` passa a somar também o Transporte.
2. **Dependentes passam a ser por benefício, não mais um único número no Empregado.** RN0253 da Minuta fala em dependentes "por auxílio" — decisão do usuário: criar `numeroDependentes` dentro da nova elegibilidade (um valor por Empregado × Benefício), não mais confiar só no campo único já existente em `EmpregadoHeadcount.numeroDependentes`. **O campo antigo (`EmpregadoHeadcount.numeroDependentes`) é mantido no schema por compatibilidade (já em produção, US-108), mas deixa de ser a fonte de verdade para cálculo de benefício** — passa a ser um dado cadastral solto, sem uso funcional nesta US. Isso é sinalizado ao Tech Lead como divergência a documentar (ADR), não removido nesta US.
3. **Nova tabela `EmpregadoBeneficioElegibilidade`**, 1 linha por Empregado × TipoBenefício (enum com os 7 valores: VA, VR, PLANO_SAUDE, PLANO_ODONTO, SEGURO_VIDA, AUXILIO_CRECHE, VALE_TRANSPORTE). Evita 21 campos soltos (7 benefícios × ativo/período/dependentes) em `EmpregadoHeadcount`, que já está com um número relevante de campos desde US-108/ADR-018.
4. **RN0274 (recálculo de Totalizadores de Benefícios da Proposta) fica fora de escopo** — mesmo padrão de toda US anterior que menciona "Totalizador"/"recálculo em lote": o `TotalizerService` formal ainda não existe como serviço arquitetural centralizado no projeto.
5. **Elegibilidade só é possível para benefícios ativos no Cargo do Empregado** — se o Cargo não tem Plano Odontológico ativo, o Empregado desse Cargo não pode marcar elegibilidade de Odonto. Valores financeiros exibidos na elegibilidade são sempre Read-only, herdados do Cargo (não duplicados/snapshot — para elegibilidade, ao contrário do custo do Empregado, faz sentido ler o valor vivo do Cargo, já que a elegibilidade em si não é um "congelamento" de custo histórico, é um registro de uso).
6. **RN0253 — obrigatoriedade de período/dependentes por categoria "Empregado", exceto Vale Transporte**: mantida como está na Minuta. Estagiário e Jovem Aprendiz não têm essa obrigatoriedade (a Minuta não deixa claro o comportamento para essas categorias — tratado como "não obrigatório" por exclusão, já que RN0253 fala especificamente em "Empregado").

### Critérios de Aceite

**Cenário 1 — Ativar elegibilidade de um benefício disponível no Cargo**
```gherkin
Dado que o Empregado "Maria da Silva" está vinculado ao Cargo "CARGO-2026-0001", que tem Plano de Saúde ativo (valor 450.00)
E o Empregado é categoria EMPREGADO
Quando o usuário ativa a elegibilidade de Plano de Saúde para Maria, com Período Inicial=2026-02-01, Período Final=2026-12-31, Nº de Dependentes=2
Então a elegibilidade é persistida em EmpregadoBeneficioElegibilidade
E um registro de auditoria `BENEFICIO_ELEGIBILIDADE_CONFIGURADA` é gravado em HistoricoOperacao
```

**Cenário 2 — Bloqueio: benefício não está ativo no Cargo do Empregado**
```gherkin
Dado que o Cargo do Empregado não tem Plano Odontológico ativo
Quando o usuário tenta ativar a elegibilidade de Plano Odontológico para esse Empregado
Então o sistema bloqueia o salvamento
E exibe a mensagem "Este benefício não está disponível no Cargo deste empregado."
```

**Cenário 3 — Bloqueio: Período de vigência fora da vigência da Proposta (RN0252)**
```gherkin
Dado que a Proposta do Empregado tem dataInicio=2026-01-01 e dataFim=2026-12-31
Quando o usuário tenta ativar um benefício com Período Final=2027-01-15
Então o sistema bloqueia o salvamento
E exibe a mensagem "Período do benefício não pode extrapolar a vigência da Proposta."
```

**Cenário 4 — Bloqueio: Empregado categoria EMPREGADO sem período/dependentes em benefício obrigatório (RN0253)**
```gherkin
Dado que o Empregado é categoria EMPREGADO
E o usuário está ativando a elegibilidade de Vale Alimentação
Quando ele tenta salvar sem preencher Período Inicial ou Nº de Dependentes
Então o sistema bloqueia o salvamento
E exibe a mensagem "Período de vigência e Nº de Dependentes são obrigatórios para este benefício."
```

**Cenário 5 — Exceção: Vale Transporte pode ser desativado sem as obrigatoriedades do Cenário 4**
```gherkin
Dado que o Empregado é categoria EMPREGADO
Quando o usuário desativa a elegibilidade de Vale Transporte, sem preencher período ou dependentes
Então o sistema aceita o salvamento normalmente
E a elegibilidade de Vale Transporte fica marcada como inativa
```

**Cenário 6 — Desativar um benefício previamente ativo**
```gherkin
Dado que o Empregado tem Vale Refeição ativo, com período e dependentes preenchidos
Quando o usuário desmarca a elegibilidade de Vale Refeição
Então o sistema salva a elegibilidade como inativa
E um registro de auditoria `BENEFICIO_ELEGIBILIDADE_EDITADA` é gravado com o estado anterior e o novo
```

**Cenário 7 — Bloqueio: tentativa de editar o valor financeiro do benefício [ORIGEM BLINDADA]**
```gherkin
Dado que o Plano de Saúde do Cargo do Empregado vale 450.00
Quando o usuário tenta submeter um valor diferente para o campo de valor do benefício na tela de elegibilidade
Então o sistema ignora esse valor
E continua exibindo o valor vivo herdado do Cargo (450.00), nunca um valor digitado na elegibilidade
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | Nova tabela `EmpregadoBeneficioElegibilidade`; `Cargo` ganha `transporteAtivo`/`transporteValorUnitario` (retrabalho US-107a/ADR-019); `Cargo.custoTotalCargo` passa a somar Transporte também |
| Campos de `EmpregadoBeneficioElegibilidade` | tenantId, empregadoId (FK), tipoBeneficio (enum TipoBeneficioElegibilidade), ativo (Boolean), periodoInicio (nullable), periodoFim (nullable), numeroDependentes (Int, default 0) |
| Transação? | Sim — validação de disponibilidade no Cargo + gravação de elegibilidade na mesma transação |
| Requer lock? | Não — mesma simplicidade transacional de Cargo/Empregado, sem concorrência relevante |
| Auditoria | `BENEFICIO_ELEGIBILIDADE_CONFIGURADA`, `BENEFICIO_ELEGIBILIDADE_EDITADA` em HistoricoOperacao |
| Regra de negócio | Benefício deve estar ativo no Cargo (Cenário 2); RN0252 (vigência dentro da Proposta); RN0253 (obrigatoriedade por categoria, exceto Transporte); valores financeiros sempre lidos do Cargo, nunca duplicados |

### Dependências

- **US-107a (Tabela Mestre do Cargo)**: satisfeita, com retrabalho pontual para adicionar Vale Transporte.
- **US-108 (Empregado)**: satisfeita — `EmpregadoBeneficioElegibilidade` referencia `EmpregadoHeadcount`.
- **Nota para o Tech Lead**: `EmpregadoHeadcount.numeroDependentes` (já em produção) fica sem uso funcional a partir desta US — documentar essa divergência (campo legado vs. novo campo granular por benefício) em ADR, decidir se marca como deprecated ou remove em uma limpeza futura.

### Definition of Done

- [ ] Critérios de aceite 1 a 7 implementados e testados
- [ ] Elegibilidade só aceita para benefícios ativos no Cargo vigente do Empregado
- [ ] Valores financeiros da elegibilidade são sempre lidos ao vivo do Cargo, nunca duplicados/digitados
- [ ] Vale Transporte tem exceção às obrigatoriedades de período/dependentes (RN0253)
- [ ] `Cargo.custoTotalCargo` recalculado para incluir Vale Transporte (retrabalho ADR-019)
- [ ] Log de auditoria gerado para configuração/edição de elegibilidade
- [ ] Testado com categoria diferente de EMPREGADO (obrigatoriedade de RN0253 não se aplica)
- [ ] Testado com tentativa de elegibilidade de benefício inativo no Cargo (deve bloquear)
