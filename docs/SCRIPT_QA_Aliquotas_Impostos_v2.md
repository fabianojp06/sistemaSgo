# Script de Teste — Central de Alíquotas de Impostos (US-123 a US-126)

**v2 — atualizado após a 1ª rodada de QA.** A 1ª rodada encontrou 3 bugs reais: (1) fuso horário
fazia "hoje" ser rejeitado como data retroativa + causava um erro de hydration mismatch na grid;
(2) campo de valor/alíquota rejeitava vírgula decimal ("1000,00"); (3) mensagens de erro vazavam
o rótulo de debug "[TRAVA O ERRO]". Os 3 foram corrigidos — os Cenários 4, 5 e 7 abaixo foram
ajustados para não precisar mais do contorno manual ("usar amanhã em vez de hoje"), e os Cenários
13-15 foram adicionados como regressão específica dos 3 bugs.

**Como usar:** ative a extensão Claude in Chrome, abra uma nova conversa com ela e cole o bloco
"PROMPT PARA COLAR" abaixo inteiro. Antes de colar, garanta que você já fez login manualmente no
SGO (Clerk) pelo menos uma vez nesse navegador — a extensão herda sua sessão do Chrome, não faz
login sozinha.

URL base: `http://localhost:3000` (ajuste se o servidor estiver em outra porta/Codespace). Servidor
já reiniciado com as correções aplicadas.

---

## PROMPT PARA COLAR NO CLAUDE IN CHROME

```
Você vai testar a tela "Alíquotas de Impostos" do SGO 2.0 em http://localhost:3000/aliquotas-impostos.
Eu já fiz login. Execute os cenários abaixo NA ORDEM, um de cada vez. Depois de cada cenário,
me diga em 1-2 linhas: PASSOU ou FALHOU, e por quê (com screenshot se falhar).

=== CENÁRIO 0 — Acesso e layout inicial ===
1. Navegue para http://localhost:3000/aliquotas-impostos
2. Confirme que a página carregou sem erro (sem tela de erro do Next.js, sem redirect pro login)
3. Confirme que existe: campo de filtro "Nome do Imposto", select "Tipo de Incidência", select
   "Status", botão "Pesquisar", botões "Exportar PDF"/"Exportar XLSX", botão "+ Novo"
4. Confirme que a tabela tem as colunas: Nome, Alíquota (%), Tipo de Incidência, Início Vigência,
   Fim Vigência, Status, Ações
RESULTADO ESPERADO: página carrega, layout completo, sem erros no console do navegador.

=== CENÁRIO 1 — Cadastrar alíquota com sucesso (UC03.40, Cenário 1) ===
1. Clique em "+ Novo"
2. Preencha: Nome do Imposto = "CSLL-TESTE", Alíquota Padrão (%) = "9.00",
   Tipo de Incidência = "Ambos", Data Início Vigência = data de hoje
3. Deixe os demais campos em branco
4. Clique em "Salvar"
RESULTADO ESPERADO: modal fecha, mensagem de sucesso (ou o registro simplesmente aparece na
grid), "CSLL-TESTE" aparece na tabela com Status "ATIVO" e Alíquota "9.00%".

=== CENÁRIO 2 — Bloqueio: nome duplicado, case-insensitive (RN_IMP_005) ===
1. Clique em "+ Novo"
2. Preencha Nome do Imposto = "csll-teste" (minúsculo, mesmo nome do Cenário 1)
3. Preencha Alíquota = "5.00", Tipo de Incidência = "Contrato", Data Início = hoje
4. Clique em "Salvar"
RESULTADO ESPERADO: formulário NÃO fecha, mensagem de erro mencionando "Já existe uma alíquota
cadastrada com o nome csll-teste". Nenhum novo registro aparece na grid.

=== CENÁRIO 3 — Bloqueio: alíquota fora da faixa 0-100% ===
1. Clique em "+ Novo"
2. Preencha Nome = "TESTE-FAIXA", Alíquota = "150", Tipo de Incidência = "Ambos", Data Início = hoje
3. Clique em "Salvar"
RESULTADO ESPERADO: erro "O valor deve estar entre 0,00% e 100,00%". Nada persistido.

=== CENÁRIO 4 — Bloqueio: ISS fora da faixa legal 2%-5% (RN_IMP_006, LC 116/2003) ===
1. Clique em "+ Novo"
2. Preencha Nome = "ISS", Alíquota = "8.00", Tipo de Incidência = "Ambos", Data Início = hoje
3. Clique em "Salvar"
RESULTADO ESPERADO: erro mencionando "ISS" e "2,00% e 5,00%" / "LC 116/2003". Nada persistido. A
mensagem NÃO deve conter o texto literal "[TRAVA O ERRO]" (bug corrigido — ver Cenário 15).
4. Repita com Alíquota = "3.50" (dentro da faixa), Data Início = HOJE (não precisa mais usar
   amanhã — bug de fuso corrigido, ver Cenário 13). Desta vez deve salvar com sucesso.

=== CENÁRIO 5 — Bloqueio: data de início retroativa (RN_IMP_007) ===
1. Clique em "+ Novo"
2. Preencha Nome = "TESTE-RETROATIVO", Alíquota = "2.00", Tipo de Incidência = "Contrato"
3. Em Data Início Vigência, selecione uma data de ONTEM
4. Clique em "Salvar"
RESULTADO ESPERADO: erro mencionando que a data não pode ser retroativa (mensagem sem o prefixo
"[TRAVA O ERRO]"). Nada persistido.

=== CENÁRIO 6 — Filtros da listagem (UC03.39) ===
1. No campo "Nome do Imposto", digite "CSLL"
2. Clique em "Pesquisar"
RESULTADO ESPERADO: só aparece "CSLL-TESTE" na grid.
3. Limpe o filtro de nome, selecione Status = "Ativo", clique em "Pesquisar"
RESULTADO ESPERADO: só registros com badge verde "ATIVO" aparecem.
4. Troque o filtro para um nome que não existe (ex: "XPTO-INEXISTENTE"), clique em "Pesquisar"
RESULTADO ESPERADO: mensagem "Nenhuma alíquota encontrada para os filtros informados." e grid vazia.
5. Limpe todos os filtros e clique em "Pesquisar" de novo para restaurar a listagem completa.

=== CENÁRIO 7 — Alterar alíquota com sucesso (UC03.41, Cenário 1) ===
1. Na linha "CSLL-TESTE", clique em "Editar"
2. Confirme que o formulário abre PRÉ-PREENCHIDO com os dados atuais, INCLUINDO a Data Início
   Vigência = hoje corretamente (bug de fuso corrigido — antes esse campo podia aparecer com o
   dia anterior)
3. Altere Alíquota Padrão (%) de "9.00" para "9.25"
4. Clique em "Salvar" SEM alterar a Data Início Vigência (deixe como está, = hoje)
RESULTADO ESPERADO: modal fecha sem erro de "data retroativa" (esse era o bug que travava esse
cenário inteiro antes). "CSLL-TESTE" aparece na grid agora com "9.25%".

=== CENÁRIO 8 — Bloqueio: renomear para nome já em uso ===
1. Clique em "Editar" na linha "TESTE-FAIXA" (se não existir por causa do Cenário 3, use
   "TESTE-RETROATIVO" — o que sobreviveu aos cenários de bloqueio)
   Se nenhum dos dois existir, pule este cenário e me avise.
2. Renomeie para "CSLL-TESTE" (nome já usado)
3. Clique em "Salvar"
RESULTADO ESPERADO: erro de nome duplicado, igual ao Cenário 2. Formulário não fecha.

=== CENÁRIO 9 — Conflito de concorrência / Optimistic Locking (RNF_TAX_006) ===
Este cenário precisa de DUAS ABAS do navegador na mesma página.
1. Abra uma segunda aba em http://localhost:3000/aliquotas-impostos
2. Na Aba 1, clique em "Editar" na linha "CSLL-TESTE", altere a Alíquota para "10.00" e SALVE
   (confirme que salvou)
3. Na Aba 2 (que ainda tem os dados antigos carregados antes do passo 2), clique em "Editar" na
   linha "CSLL-TESTE" — MAS NÃO recarregue a página antes de editar
4. Na Aba 2, altere a Alíquota para "11.00" e clique em "Salvar"
RESULTADO ESPERADO: a Aba 2 recebe um erro de conflito de concorrência ("Outro usuário modificou
este registro simultaneamente" ou HTTP 409), NÃO sobrescreve silenciosamente o valor salvo pela
Aba 1. Recarregue a Aba 2 e confirme que o valor exibido é "10.00" (o da Aba 1), não "11.00".

=== CENÁRIO 10 — Excluir sem referência (sucesso, UC03.42) ===
1. Localize a linha "TESTE-RETROATIVO" ou "TESTE-FAIXA" (qualquer registro criado nos testes que
   NUNCA foi usado em nenhum Rateio de Impostos de Proposta)
2. Confirme que o botão "Excluir" está HABILITADO nessa linha
3. Clique em "Excluir"
4. Confirme que aparece um modal de confirmação mencionando o nome da alíquota
5. Clique em "Confirmar"
RESULTADO ESPERADO: modal fecha, o registro some da listagem padrão (ou aparece como "INATIVO"
se o filtro de Status não for "Ativo").

=== CENÁRIO 11 — Bloqueio de exclusão por referência ativa (RN_IMP_009) ===
Este cenário depende de existir uma Proposta em RASCUNHO/EM_ELABORACAO com um Rateio de Imposto
configurado usando alguma alíquota (ex: ISS). Se você não souber se isso existe:
1. Navegue para http://localhost:3000/propostas
2. Abra qualquer Proposta em status Rascunho ou Em Elaboração
3. Vá na aba "Rateio de Impostos" e configure um rateio usando a alíquota "ISS" (se ainda não
   houver nenhum) — preencha Conta, Competência e Valor Declarado, e salve
4. Volte para http://localhost:3000/aliquotas-impostos
5. Localize a linha "ISS"
RESULTADO ESPERADO: o botão "Excluir" da linha "ISS" aparece DESABILITADO (cinza, não clicável),
com tooltip/title mencionando "Referenciada em Propostas ativas". Se por algum motivo o botão
estiver clicável, clique nele e confirme que o sistema bloqueia com uma mensagem de erro
explícita — NUNCA deve excluir silenciosamente.

=== CENÁRIO 12 — Exportação PDF/XLSX ===
1. Com qualquer filtro aplicado (ex: Status = Ativo), clique em "Exportar PDF"
RESULTADO ESPERADO: um download de PDF é iniciado, sem erro no console.
2. Clique em "Exportar XLSX"
RESULTADO ESPERADO: um download de XLSX é iniciado, sem erro no console.
(Não precisa abrir os arquivos baixados — só confirmar que o download disparou sem exceção.)

=== CENÁRIO 13 — Regressão: sem erro de hydration mismatch, datas exibidas corretamente ===
1. Recarregue http://localhost:3000/aliquotas-impostos (F5, hard refresh)
2. Abra o console do navegador (DevTools)
RESULTADO ESPERADO: nenhum erro de "Hydration failed" / "server rendered text didn't match the
client" no console ou na tela.
3. Cadastre uma alíquota nova com Nome = "REGRESSAO-DATA", Alíquota = "1.00", Tipo de Incidência
   = "Contrato", Data Início Vigência = HOJE
4. Confirme que a coluna "Início Vigência" na grid mostra a data de HOJE (não ontem)

=== CENÁRIO 14 — Regressão: vírgula decimal aceita ===
1. Clique em "+ Novo"
2. Preencha Nome = "REGRESSAO-VIRGULA", Alíquota Padrão (%) = "2,50" (COM VÍRGULA), Tipo de
   Incidência = "Ambos", Data Início = hoje
3. Clique em "Salvar"
RESULTADO ESPERADO: salva com sucesso, sem erro "[DecimalError] Invalid argument". Alíquota
aparece na grid como "2.50%".
4. Vá em http://localhost:3000/propostas, abra qualquer Proposta em Rascunho/Em Elaboração, aba
   "Rateio de Impostos", preencha "Valor Declarado" com "1500,00" (COM VÍRGULA) e salve.
RESULTADO ESPERADO: salva sem erro "[DecimalError]".

=== CENÁRIO 15 — Regressão: mensagens de erro sem rótulo de debug ===
1. Repita o Cenário 2 (nome duplicado) ou o Cenário 3 (alíquota fora da faixa)
RESULTADO ESPERADO: a mensagem de erro exibida NÃO contém o texto literal "[TRAVA O ERRO]" em
nenhum lugar — nem colado nem com underscore. O texto deve ser só a frase de negócio (ex:
"Operação Rejeitada: Já existe uma alíquota cadastrada com o nome...", sem prefixo entre
colchetes).

=== AO FINAL ===
Me dê um resumo em tabela: Cenário | PASSOU/FALHOU | Observação.
Se algum cenário falhou, inclua: URL da página, mensagem de erro exata (texto na tela ou console),
e o que você esperava vs o que aconteceu.
```

---

## Notas para você (não faz parte do prompt acima)

- **Cenário 9 (concorrência)** é o mais delicado de automatizar via linguagem natural — se o
  Claude in Chrome tiver dificuldade em manter duas abas sincronizadas, pode pular e você testa
  manualmente: abra duas abas, edite na primeira e salve, depois tente editar/salvar na segunda
  sem recarregar.
- **Cenário 11** depende de dados de Proposta existirem no seu ambiente — se não houver nenhuma
  Proposta em Rascunho/Em Elaboração, o próprio script cria o vínculo antes de testar o bloqueio.
- Os nomes de teste usam sufixo "-TESTE" de propósito, para você conseguir identificar e limpar
  depois (excluir manualmente) sem misturar com dados reais.
- Cenários 1-8, 10, 12 cobrem US-123/124/125/126 na íntegra; Cenário 9 cobre especificamente
  RNF_TAX_006 (Optimistic Locking); Cenário 11 cobre RN_IMP_009 (trava de exclusão); Cenários
  13-15 são regressão dos 3 bugs achados na 1ª rodada de QA (fuso/hydration, vírgula decimal,
  rótulo "[TRAVA O ERRO]" vazando).
- Registros de teste da 1ª rodada (CSLL-TESTE, TESTE-EXCLUSAO, rateio de ISS em PROP-2026-0001)
  já foram limpos do banco. Novos nomes de teste desta rodada (REGRESSAO-DATA, REGRESSAO-VIRGULA,
  etc.) também usam sufixo/prefixo identificável — pode pedir para eu limpar de novo ao final.
