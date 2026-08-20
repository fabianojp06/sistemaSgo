
US-138 — Relatório de Cronograma de Desembolso (Consolidado por Termo de Parceria)

**Módulo:** Orçamentário
**Épico:** EP48/26 — Módulo Orçamentário
**Prioridade:** Média
**Status:** Implementada — commit pendente, branch `feature/us-138-relatorio-cronograma-desembolso`

**Como** Usuário Comum ou Gestor Financeiro (GFIN),
**Quero** consultar um relatório consolidado do Cronograma de Desembolso de um Termo de Parceria Oficializado, com filtro por Termo Aditivo e Exercício, e exportá-lo em PDF/XLSX com trilha de auditoria,
**Para** acompanhar a saúde financeira do contrato e emitir documento oficial para controladoria/auditoria, sem depender de abrir a Proposta e navegar até sua aba interna.

## Contexto e origem

Baseada no documento `docs/Cronograma de Desembolso-VersaoUsuarioFinal.docx` (anexado pelo usuário em 2026-08-20). É uma funcionalidade **nova**, distinta da aba "Cronograma de Desembolso" já existente dentro do detalhe da Proposta (US-122/UC04.01, `propostas/[id]/cronograma-desembolso`):

| | US-122 (aba, existente) | US-138 (relatório, esta US) |
|---|---|---|
| Onde | Aba dentro do detalhe de uma Proposta já aberta | Página própria, a partir de um card na landing `/orcamentario` |
| Seleção da Proposta | Implícita (já é a Proposta aberta) | Explícita, via combo — só `status = OFICIALIZADO` |
| Filtros | Nenhum | Termo Aditivo (informativo), Ano de Exercício (recorta os meses exibidos) |
| Linha de Totais Finais | Não tem | Tem (Cenário 5) |
| Auditoria | Nenhuma encontrada no código | Grava `HistoricoOperacao` a cada exportação (Imprimir/PDF/XLSX), ANTES de liberar o arquivo |

## Decisões do AN/PO (autorizadas pelo usuário a critério do assistente, 2026-08-20)

1. **Posição na tela:** novo card na landing `/orcamentario`, não um menu "Gerenciador de Relatórios" separado (que não existe no sistema).
2. **"GFIN"** já é termo estabelecido no projeto (Gestor Financeiro), sinônimo de Orçamentista — sem gap.
3. **"Aditivos"** mapeado para `TermoAjuste` (US-111/UC03.13) com `status = HOMOLOGADO`. Escopo restrito de propósito: o filtro é só **informativo** (aparece no cabeçalho do relatório) — não existe regra especificada de como um Termo de Ajuste homologado deveria alterar a distribuição mês a mês do cronograma, e inventar essa regra seria risco maior que valor.
4. **Ano de Exercício** entra na v1 — recorta os meses já calculados pela vigência completa da Proposta (o Desembolso Acumulado e % Financeiro Acumulado continuam calculados contra o total global, não o total do exercício filtrado).
5. **Nomenclatura "Mês N"** mantida igual à aba US-122 (documento original pedia "Código T"/T1,T2 — decisão deliberada de manter consistência entre as duas telas em vez de introduzir uma segunda convenção).
6. **Auditoria só na exportação** (Imprimir/PDF/XLSX), não em toda visualização — consistente com o padrão do resto do sistema (audita escrita/exportação, não leitura).
7. **Falha ao gravar auditoria bloqueia o download** (Cenário 8) — trade-off deliberado de conformidade sobre disponibilidade.
8. Nova Funcionalidade: `orcamentario.cronograma-desembolso-relatorio.visualizar`.

## Critérios de Aceite — BDD/Gherkin

Ver a íntegra dos 9 cenários na conversa original de refinamento (2026-08-20) — resumo:
1. Geração bem-sucedida (caminho feliz).
2. Filtro por Termo Aditivo (só informativo no cabeçalho).
3. Filtro por Ano de Exercício.
4. Preenchimento automático (sem filtro de ano = vigência completa).
5. Linha de Totais Finais.
6. Bloqueio — Termo de Parceria não selecionado.
7. Bloqueio — Proposta sem dados financeiros.
8. Bloqueio — falha ao gravar a trilha de auditoria na exportação.
9. Exportação PDF/XLSX com sucesso (auditoria gravada antes do download).

## Impacto técnico (como implementado)

| Aspecto | Detalhe |
|---|---|
| Migration | `20260820150000_add_relatorio_cronograma_desembolso_exportado_enum` — `ALTER TYPE "TipoOperacao" ADD VALUE 'RELATORIO_CRONOGRAMA_DESEMBOLSO_EXPORTADO'`. **Criada mas não aplicada em produção** — aguardando `/code-review` e decisão do usuário sobre quando rodar `prisma migrate deploy` (DATABASE_URL do ambiente aponta para produção). |
| Novo use case | `RegistrarExportacaoRelatorioCronogramaUseCase` (grava `HistoricoOperacao`; propaga `FalhaAuditoriaExportacaoRelatorioError` se o INSERT falhar) |
| Novos erros | `FalhaAuditoriaExportacaoRelatorioError`, `RelatorioCronogramaDesembolsoSemPropostaError` (`src/domain/plano-contas/errors.ts`) |
| Nova Server Action | `registrarExportacaoCronogramaAction` (`src/app/(autenticado)/orcamentario/cronograma-desembolso-relatorio/actions.ts`) |
| Nova página | `src/app/(autenticado)/orcamentario/cronograma-desembolso-relatorio/page.tsx` — form GET com filtros (Termo de Parceria/Termo Aditivo/Ano), reaproveita `montarCronogramaDesembolso` (mesmo motor de cálculo da US-122) |
| Novo componente | `RelatorioCronogramaDesembolsoPanel.tsx` — variante de `CronogramaDesembolsoPanel.tsx` (US-122) com Linha de Totais Finais e exportação gated pela auditoria |
| Nova Funcionalidade (seed) | `orcamentario.cronograma-desembolso-relatorio.visualizar` (`prisma/seed.mjs`) — Administrador recebe automaticamente |
| Card na landing | `/orcamentario/page.tsx` — card "Relatório de Cronograma de Desembolso", visível só com a permissão acima |

## Pendências antes do merge

- [x] Migration aplicada em produção (`prisma migrate deploy`, 2026-08-20, autorizado pelo usuário)
- [x] Seed rodada (2026-08-20, autorizado pelo usuário) — `Funcionalidade` vinculada ao perfil Administrador
- [x] `/code-review` (high) rodado na branch — 2 achados de alta severidade corrigidos (ver abaixo), 1 médio e 4 menores registrados para depois
- [ ] Validação manual em tela (screenshot autenticado) antes de considerar concluída

## Achados do `/code-review` (2026-08-20) e resolução

| Severidade | Achado | Resolução |
|---|---|---|
| Alta | `registrarExportacaoCronogramaAction` não checava permissão antes de gravar auditoria — qualquer usuário do tenant podia forjar entrada na trilha | **Corrigido** — action agora chama `usuarioTemFuncionalidade` antes do use case |
| Alta | Filtro `status: 'OFICIALIZADO'` torna a tela inacessível, pois nenhum caminho do sistema hoje transiciona Proposta para esse status (gap pré-existente, fora do escopo desta US) | **Mitigado em 2 etapas por decisão do usuário:** primeiro ampliado para `{ in: ['OFICIALIZADO', 'EM_ELABORACAO'] }` (2026-08-20); depois, com dado real de produção mostrando que nem isso bastava (screenshot em anexo à conversa — combo continuava vazio), **removido por completo** (2026-08-20) — o relatório aceita Proposta de **qualquer status** (`RASCUNHO`/`EM_ELABORACAO`/`OFICIALIZADO`/`ENCERRADO`). **Débito técnico registrado:** quando existir a funcionalidade de "Oficializar Proposta", reavaliar se o filtro deve voltar a restringir por status (a mensagem de bloqueio do Cenário 6 ainda cita "Termo de Parceria Oficializado" no texto literal do documento, mas não há mais essa restrição de fato — só exige que algum Termo de Parceria seja selecionado) |
| Média | Cenário 7 (proposta sem dados financeiros) não dispara quando a Proposta não tem `VersaoProposta` vigente/ativa — tela fica em branco | **Não corrigido ainda** — pendente |
| Baixa (4) | Duplicação de código entre os dois painéis de Cronograma; `termoAditivoId` grava `""` em vez de `null` na auditoria quando "Todos"; classe de erro `RelatorioCronogramaDesembolsoSemPropostaError` morta; prop `propostaId` não usada no painel; query sequencial em vez de `Promise.all` na landing | **Não corrigidos ainda** — pendentes, sem risco de segurança/correção crítica |
