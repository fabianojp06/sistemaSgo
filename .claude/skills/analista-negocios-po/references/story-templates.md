# Story Templates — SGO 2.0
 
Templates completos com exemplos do domínio orçamentário/financeiro.
 
---
 
## Exemplo completo: Criar Empenho
 
```
## [US-001] — Criar Empenho Ordinário
 
**Módulo:** Empenhos
**Épico:** EP-001 — Ciclo de Execução da Despesa
**Prioridade:** Alta
**Estimativa:** G
 
**Como** Ordenador de Despesa,
**Quero** criar um empenho vinculado a uma dotação com saldo disponível,
**Para** reservar recursos orçamentários e autorizar formalmente o compromisso de despesa,
conforme exigido pelo Art. 58 da Lei 4.320/64.
 
### Contexto e Regras de Negócio
 
O empenho é o primeiro estágio da despesa pública. Após sua criação, o saldo disponível
da dotação é imediatamente reduzido pelo valor empenhado. Empenho ordinário pressupõe
valor exato e pagamento único — não permite liquidação parcial.
 
A criação do empenho só é permitida enquanto o exercício orçamentário estiver aberto
e a dotação ativa com saldo suficiente.
 
### Critérios de Aceite
 
**Cenário 1 — Empenho criado com sucesso**
```gherkin
Dado que o usuário possui perfil "Ordenador de Despesa"
  E a dotação "01.001 — Pessoal e Encargos" possui saldo disponível de R$ 50.000,00
  E o exercício orçamentário de 2025 está aberto
Quando o usuário preenche:
  | Campo          | Valor                          |
  | Dotação        | 01.001 — Pessoal e Encargos    |
  | Tipo           | Ordinário                      |
  | Favorecido     | Empresa X LTDA — CNPJ 00.000.000/0001-00 |
  | Valor          | R$ 12.500,00                   |
  | Descrição      | Contratação de serviço X       |
E confirma a criação
Então o empenho é criado com status "PENDENTE"
  E o saldo disponível da dotação passa para R$ 37.500,00
  E um número sequencial de empenho é gerado (ex: EMP-2025-0001)
  E o log de auditoria registra: ator, data/hora, dotação, valor empenhado
  E a tela exibe a confirmação com o número do empenho gerado
```
 
**Cenário 2 — Saldo insuficiente**
```gherkin
Dado que a dotação possui saldo disponível de R$ 5.000,00
Quando o usuário tenta criar um empenho no valor de R$ 8.000,00
Então o sistema exibe: "Saldo insuficiente. Saldo disponível na dotação: R$ 5.000,00"
  E o empenho não é criado
  E o saldo da dotação não é alterado
  E nenhum registro de auditoria é gerado
```
 
**Cenário 3 — Dotação bloqueada**
```gherkin
Dado que a dotação "02.003 — Material de Consumo" possui status "BLOQUEADA"
Quando o usuário tenta criar um empenho nessa dotação
Então o sistema exibe: "Não é possível empenhar. A dotação selecionada está bloqueada."
  E o campo de confirmação é desabilitado
```
 
**Cenário 4 — Usuário sem permissão**
```gherkin
Dado que o usuário possui perfil "Analista" (sem permissão de empenhar)
Quando o usuário acessa a tela de criação de empenho
Então o botão "Criar Empenho" não é exibido
  E ao tentar acessar a rota diretamente, recebe HTTP 403
```
 
**Cenário 5 — Cancelamento do empenho criado**
```gherkin
Dado que o empenho EMP-2025-0001 possui status "PENDENTE"
  E não possui nenhuma liquidação vinculada
Quando o Ordenador de Despesa cancela o empenho com motivo "Serviço não contratado"
Então o status do empenho passa para "CANCELADO"
  E o saldo da dotação é restaurado em R$ 12.500,00
  E o log de auditoria registra o cancelamento com o motivo informado
  E o empenho permanece visível na listagem com status "CANCELADO" (nunca deletado)
```
 
### Impacto Técnico
 
| Aspecto           | Detalhe                                                         |
|-------------------|---------------------------------------------------------------------|
| Tabelas afetadas  | `empenhos`, `dotacoes`, `log_auditoria`                        |
| Campos alterados  | `dotacoes.saldo_disponivel` (decremento), `empenhos.status`    |
| Transação?        | Sim — criação do empenho + débito de saldo em `$transaction`   |
| Requer lock?      | Sim — `SELECT FOR UPDATE` na dotação antes do débito           |
| Auditoria         | `log_auditoria`: operacao=CREATE, entidade=empenhos            |
| Número gerado     | Sequencial por org + exercício: `EMP-{ano}-{seq:04d}`          |
 
### Dependências
 
- Cadastro de dotações ativo (EP-000)
- Cadastro de favorecidos / fornecedores (EP-000)
- Perfis e permissões configurados (EP-000)
### Definition of Done
 
- [ ] Empenho criado com todos os campos obrigatórios
- [ ] Saldo da dotação decrementado atomicamente com a criação do empenho
- [ ] Número sequencial gerado corretamente sem duplicidade
- [ ] Todos os cenários de erro exibem a mensagem especificada
- [ ] Log de auditoria gerado em todos os cenários de sucesso
- [ ] Usuário sem permissão não acessa a funcionalidade (via UI e via API)
- [ ] Cenário de cancelamento testado com restauração de saldo verificada
```
 
---
 
## Exemplo: Épico completo
 
```
## [EP-001] — Ciclo de Execução da Despesa
 
**Objetivo de negócio:** Implementar o ciclo completo empenho → liquidação → pagamento
conforme Lei 4.320/64, com rastreabilidade total e integridade financeira garantida.
 
**Normativo:** Lei 4.320/64 (Arts. 58–64), Lei 14.133/21 (quando aplicável)
**Módulo SGO:** Execução Orçamentária e Financeira
 
### Histórias de Usuário do Épico
 
| ID      | Título                                         | Prioridade | Estimativa | Dependências |
|---------|--------------------------------------------------|------------|------------|--------------|
| US-001  | Criar empenho ordinário                        | Alta       | G          | —            |
| US-002  | Criar empenho global/estimativo                | Alta       | G          | US-001       |
| US-003  | Cancelar empenho sem liquidação                | Alta       | M          | US-001       |
| US-004  | Anular parcialmente empenho global             | Média      | M          | US-002       |
| US-005  | Registrar liquidação de empenho                | Alta       | G          | US-001       |
| US-006  | Estornar liquidação confirmada                 | Alta       | M          | US-005       |
| US-007  | Registrar pagamento de empenho liquidado       | Alta       | G          | US-005       |
| US-008  | Consultar extrato de execução por dotação      | Média      | M          | US-001       |
| US-009  | Exportar empenhos por período (CSV/PDF)        | Média      | P          | US-001       |
 
### Critérios de Saída do Épico
 
- [ ] Ciclo completo (empenho → liquidação → pagamento) executável na interface
- [ ] Saldos de dotação corretos após cada operação
- [ ] Log de auditoria completo para todas as operações do ciclo
- [ ] Cancelamento e estorno funcionando com restauração de saldo
- [ ] Relatório de execução por dotação disponível
```
 
---
 
## Exemplo: Regra de negócio OSCIP
 
```
## [US-042] — Solicitar Remanejamento de Rubrica
 
**Módulo:** Plano de Aplicação (OSCIP)
**Épico:** EP-005 — Gestão do Termo de Parceria
**Prioridade:** Alta
**Estimativa:** G
 
**Como** Gestor Financeiro da OSCIP,
**Quero** solicitar remanejamento de saldo entre rubricas do termo de parceria,
**Para** adequar a execução financeira às necessidades do projeto sem perder conformidade
com o Decreto 3.100/99 e as cláusulas do instrumento.
 
### Contexto e Regras de Negócio
 
O remanejamento até 10% do valor da rubrica de origem não requer autorização prévia do
concedente. Acima desse limite, é obrigatório anexar o ofício de aprovação do concedente
antes de efetivar o remanejamento no sistema.
 
O sistema deve calcular o percentual automaticamente, bloquear o remanejamento que
ultrapasse o limite sem aprovação, e registrar o histórico completo de remanejamentos
para fins de prestação de contas.
 
### Critérios de Aceite
 
**Cenário 1 — Remanejamento dentro do limite (até 10%)**
```gherkin
Dado que a rubrica "01 — Pessoal" possui valor aprovado de R$ 20.000,00
  E o remanejamento solicitado é de R$ 1.500,00 para a rubrica "02 — Custeio"
  E 1.500 representa 7,5% do valor da rubrica de origem
Quando o Gestor Financeiro confirma o remanejamento com justificativa
Então o sistema efetiva o remanejamento sem exigir aprovação do concedente
  E o saldo da rubrica "01 — Pessoal" é reduzido em R$ 1.500,00
  E o saldo da rubrica "02 — Custeio" é acrescido em R$ 1.500,00
  E o registro indica "Remanejamento — Aprovação não requerida (7,5% do valor da rubrica)"
  E o histórico de remanejamentos é atualizado
```
 
**Cenário 2 — Remanejamento acima do limite (> 10%) sem aprovação**
```gherkin
Dado que a rubrica "01 — Pessoal" possui valor aprovado de R$ 20.000,00
  E o remanejamento solicitado é de R$ 3.000,00 (15% do valor da rubrica)
Quando o Gestor tenta confirmar sem anexar ofício de aprovação
Então o sistema exibe: "Remanejamento de R$ 3.000,00 representa 15% da rubrica de origem,
  ultrapassando o limite de 10% permitido sem autorização. Anexe o ofício de aprovação
  do concedente para prosseguir."
  E o botão "Confirmar" permanece desabilitado
  E nenhum saldo é alterado
```
 
**Cenário 3 — Remanejamento acima do limite com aprovação anexada**
```gherkin
Dado que o Gestor informou o número do ofício "OF-2025-042" e anexou o documento
Quando confirma o remanejamento de R$ 3.000,00
Então o remanejamento é efetivado
  E o registro indica "Remanejamento — Aprovado via OF-2025-042"
  E o documento é vinculado ao registro para consulta futura
```
 
### Impacto Técnico
 
| Aspecto           | Detalhe                                                                |
|-------------------|----------------------------------------------------------------------------|
| Tabelas afetadas  | `rubricas`, `remanejamentos`, `log_auditoria`                         |
| Campos alterados  | `rubricas.saldo_disponivel` (duas linhas — origem e destino)          |
| Transação?        | Sim — débito + crédito de rubrica atomicamente                        |
| Regra de negócio  | `percentual = valor_remanejamento / valor_aprovado_rubrica_origem × 100` |
| Limite            | 10% — parametrizável por concedente                                   |
| Auditoria         | Registrar: origem, destino, valor, percentual, ofício (se aplicável)  |
```
