# Report Specs — SGO 2.0
 
Templates de especificação para relatórios, exportações e painéis do sistema.
 
---
 
## Template de Especificação de Relatório
 
```
## [REL-NNN] — [Nome do Relatório]
 
**Módulo:** [Dotações / Empenhos / Prestação de Contas]
**Tipo:** Tela / Exportação PDF / Exportação CSV / Painel (dashboard)
**Normativo:** [Lei, Decreto, IN — se o relatório for exigido por norma]
**Periodicidade:** Sob demanda / Mensal / Trimestral / Anual
**Perfis com acesso:** [Ordenador / Analista / Contador / Auditor]
 
### Filtros disponíveis
 
| Filtro         | Tipo          | Obrigatório | Valor padrão               |
|----------------|---------------|-------------|-------------------------------|
| Período        | Date range    | Sim         | Mês atual                  |
| Dotação        | Seleção múltipla | Não      | Todas                      |
| Status         | Checkbox      | Não         | Todos                      |
| Favorecido     | Busca textual | Não         | —                          |
 
### Colunas / Campos do Relatório
 
| # | Campo            | Origem (tabela.campo)     | Formato             | Total? |
|---|------------------|------------------------------|----------------------|--------|
| 1 | Nº do Empenho    | empenhos.numero           | Texto               | —      |
| 2 | Data de Empenho  | empenhos.criado_em        | DD/MM/AAAA          | —      |
| 3 | Dotação          | dotacoes.codigo           | Texto               | —      |
| 4 | Favorecido       | favorecidos.nome          | Texto               | —      |
| 5 | Valor Empenhado  | empenhos.valor            | R$ #.###.##0,00     | Sim    |
| 6 | Valor Liquidado  | Σ liquidacoes.valor       | R$ #.###.##0,00     | Sim    |
| 7 | Valor Pago       | Σ pagamentos.valor        | R$ #.###.##0,00     | Sim    |
| 8 | Saldo a Liquidar | col5 − col6               | R$ #.###.##0,00     | Sim    |
| 9 | Status           | empenhos.status           | Badge               | —      |
 
### Totalizadores
 
- Total geral de cada coluna numérica no rodapé
- Subtotal por dotação (quando agrupado por dotação)
 
### Comportamento de exportação
 
- **PDF:** Cabeçalho com nome do org, período filtrado, data de geração e usuário
- **CSV:** Primeira linha = cabeçalhos; valores monetários sem símbolo R$ (ex: 12500.00)
- Volumes > 1.000 registros: executar em background com notificação ao concluir
- Arquivo disponível para download por 24h
 
### Critérios de Aceite do Relatório
 
```gherkin
Dado que existem 3 empenhos no período selecionado
  E o usuário possui perfil "Analista"
Quando o usuário aplica o filtro "Janeiro/2025" e clica em "Gerar"
Então os 3 empenhos são exibidos na tela
  E os totalizadores somam corretamente os valores das colunas numéricas
  E o botão "Exportar PDF" gera um PDF com os mesmos dados filtrados
 
Dado que o período não possui empenhos
Quando o usuário aplica o filtro e clica em "Gerar"
Então a tela exibe "Nenhum registro encontrado para o período selecionado"
  E os botões de exportação ficam desabilitados
```
```
 
---
 
## Relatórios Obrigatórios do SGO 2.0
 
### REL-001 — Execução Orçamentária por Dotação
 
**Normativo:** Art. 72, Lei 4.320/64 (Balanço Orçamentário)
 
Colunas obrigatórias:
| Campo                  | Fórmula                                          |
|--------------------------|------------------------------------------------------|
| Dotação Inicial        | Valor aprovado na LOA / Plano de Aplicação       |
| Suplementações (+)     | Σ suplementações aprovadas                       |
| Anulações (−)          | Σ anulações realizadas                           |
| **Dotação Atual**      | Inicial + Suplementações − Anulações            |
| Empenhado              | Σ empenhos não cancelados                        |
| Liquidado              | Σ liquidações confirmadas                        |
| Pago                   | Σ pagamentos realizados                          |
| **Saldo a Empenhar**   | Dotação Atual − Empenhado                       |
| **Saldo a Liquidar**   | Empenhado − Liquidado                           |
| **Saldo a Pagar**      | Liquidado − Pago                               |
| **% Execução**         | (Empenhado / Dotação Atual) × 100              |
 
---
 
### REL-002 — Extrato de Empenhos por Favorecido
 
Permite ao Contador/Auditor verificar todos os empenhos de um determinado fornecedor.
Útil para verificar limite de dispensa de licitação (Art. 75, Lei 14.133/21).
 
Filtros: favorecido (obrigatório), período, status.
Deve exibir soma acumulada por favorecido no período.
 
---
 
### REL-003 — Prestação de Contas por Rubrica (OSCIP)
 
**Normativo:** Decreto 3.100/99, Art. 11
 
| Campo                  | Descrição                                        |
|--------------------------|------------------------------------------------------|
| Rubrica                | Código e descrição conforme Plano de Aplicação  |
| Valor Aprovado         | Valor original da rubrica no instrumento         |
| Remanejamentos (+/−)   | Saldo líquido de remanejamentos                 |
| **Valor Atual**        | Aprovado ± Remanejamentos                       |
| Despesas Confirmadas   | Σ despesas com comprovante aceito               |
| **Saldo**              | Valor Atual − Despesas Confirmadas              |
| **% Executado**        | (Despesas / Valor Atual) × 100                 |
| Situação               | DENTRO DO PRAZO / EM RISCO / EXECUTADO / PENDENTE |
 
---
 
### REL-004 — Log de Auditoria (Trilha de Auditoria)
 
Acesso restrito: perfil "Auditor" ou "Administrador".
 
Exibe todas as alterações em documentos financeiros com:
- Data/hora, usuário, IP, entidade afetada, operação, valor anterior, valor novo
- Filtro por: entidade, usuário, período, tipo de operação
- Exportação CSV obrigatória
- Registros imutáveis — sem opção de editar ou excluir na interface
 
---
 
## Padrão de Formatação de Valores Monetários
 
| Contexto         | Formato                  | Exemplo           |
|--------------------|-----------------------------|--------------------|
| Tela (exibição)  | R$ #.###.##0,00          | R$ 12.500,00      |
| Tela (negativo)  | (R$ #.###.##0,00)        | (R$ 500,00)       |
| CSV/Excel        | Numérico sem símbolo     | 12500.00          |
| PDF cabeçalho    | R$ #.###.##0,00          | R$ 12.500,00      |
| Totalizador PDF  | **R$ #.###.##0,00**      | **R$ 125.000,00** |
 
Locale: `pt-BR`. Separador de milhar: `.` Separador decimal: `,`
