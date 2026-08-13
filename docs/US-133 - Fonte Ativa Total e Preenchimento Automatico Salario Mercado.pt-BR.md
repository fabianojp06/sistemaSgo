## [US-133] — Fonte Ativa ampliada (Total) + Preenchimento Automático via Tabela Salarial

**Módulo:** Cadastros — Cargos e Salários (UC03.19, Bloco B/seção 5.2 da Rev. Jun/2026)
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** P

**Como** Usuário GRH,
**Quero** escolher "Total" como Fonte Ativa (além de Mínimo/Máximo/Real) e preencher Salário Mín/Máx do Cargo automaticamente a partir de uma faixa da Tabela Salarial (US-131),
**Para** ter mais flexibilidade na base de cálculo orçamentário e não digitar de memória valores que já existem na pesquisa de mercado cadastrada.

### Contexto e Regras de Negócio

Documento de origem: seção 4.2 (Fonte Ativa), seção 5.2 (Comportamento de Consulta), RN_TAB_04/05. O enum atual `FonteAtivaSalario` só tem `MERCADO_MINIMO`/`MERCADO_MAXIMO`/`RUBI` — falta o valor `TOTAL` (Salário Mín ou Máx + Função Gratificada) que o documento pede como 4ª opção.

**Preenchimento automático (RN_TAB_04):** ao selecionar uma faixa na Tabela Salarial (US-131, Cenário 5), o sistema copia `salarioMinimo`/`salarioMaximo` para `Cargo.salarioMercadoMinimo`/`salarioMercadoMaximo` e grava a origem como `TABELA_SALARIAL`. Os campos continuam editáveis depois — uma edição manual muda a origem para `MANUAL` (RN_TAB_05). A origem é registrada no Snapshot de Oficialização (ver US-134).

### Critérios de Aceite

**Cenário 1 — Preencher Salário Mín/Máx a partir da Tabela Salarial**
```gherkin
Dado que o usuário está na tela de Cargos, cadastrando "Analista de Sistemas"
E a Tabela Salarial tem um registro Sênior com Mín=6500.00/Máx=9200.00
Quando o usuário abre "Tabela Salarial", seleciona o registro Sênior
Então o sistema copia salarioMercadoMinimo=6500.00 e salarioMercadoMaximo=9200.00 para o Cargo
E exibe o indicador "Preenchido via Tabela Salarial — Analista de Sistemas / Sênior"
E grava origemSalarioMin=TABELA_SALARIAL, origemSalarioMax=TABELA_SALARIAL
```

**Cenário 2 — Edição manual após preenchimento automático muda a origem**
```gherkin
Dado que o Cargo teve Salário Mínimo preenchido via Tabela Salarial (Cenário 1)
Quando o usuário edita manualmente o campo Salário Mínimo para um valor diferente
Então o sistema atualiza o indicador para "Editado manualmente"
E grava origemSalarioMin=MANUAL
E origemSalarioMax permanece TABELA_SALARIAL (independente por campo)
```

**Cenário 3 — Selecionar Fonte Ativa = Total**
```gherkin
Dado que o Cargo tem Salário Mínimo=6500.00, Função Gratificada=800.00
Quando o usuário seleciona Fonte Ativa = "Total"
Então o sistema calcula Salário Total = Salário Mín ou Máx (conforme já configurado) + Função Gratificada
E usa esse valor como base para o cálculo de encargos (ver GAP-CAR-004, US ainda não escrita)
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `Cargo` — novo valor de enum `FonteAtivaSalario.TOTAL`; 2 novos campos `origemSalarioMin`/`origemSalarioMax` (enum `TABELA_SALARIAL`\|`MANUAL`) |
| Migration | `ALTER TYPE "FonteAtivaSalario" ADD VALUE 'TOTAL'` — aplicar **antes** de qualquer deploy de código que grave esse valor (mesma ordem de risco já registrada em ADR-034); + colunas novas de origem |
| Transação? | Não — preenchimento automático é só cópia de 2 campos numéricos + 2 campos de origem, no mesmo update do Cargo |
| Auditoria | Origem registrada nos campos do próprio Cargo; refletida no Snapshot de Oficialização (US-134) |
| Regra de negócio | `calcularSalarioTotalCargo` (já existe, US-107) precisa aceitar o novo caso `FonteAtivaSalario.TOTAL` |

### Dependências

- US-131 (Tabela Salarial) — fonte dos dados copiados
- US-134 (Snapshot) — persiste a origem no DNA de custo

### Definition of Done

- [ ] Fonte Ativa = Total implementada e calculando corretamente
- [ ] Preenchimento automático com indicador de origem testado
- [ ] Edição manual após preenchimento automático muda a origem corretamente, campo a campo (Mín e Máx são independentes)
- [ ] Migration de enum aplicada antes do deploy do código consumidor
