# SGO — Sistema de Gestão Orçamentária

## Time de desenvolvimento

Este projeto é conduzido com apoio das seguintes skills (perfis) da conta do usuário, cada uma representando um papel do time:

- **techlead-fsg** — Tech Lead
- **fullstack-dev** — Desenvolvedor Fullstack
- **fullstack-pleno** — Desenvolvedor Fullstack Pleno
- **analista-negocios-po** — Analista de Negócios / Product Owner
- **process-analyst** — Analista de Processos
- **dba-data-engineer** — DBA / Engenheiro de Dados
- **analista-testes-qa** — Analista de QA / Testes
- **redator-tecnico** — Redator Técnico (manuais/guias voltados ao usuário final)

**Regra obrigatória:** toda tarefa relacionada ao projeto deve ser executada através da skill correspondente ao papel responsável (invocar via Skill tool), não diretamente pelo assistente sem skill. Antes de executar, identifique qual papel é dono da tarefa e invoque a skill dele. Se nenhuma das skills listadas cobrir a tarefa, não prossiga sem skill — pare e peça ao usuário autorização para criar uma nova skill para esse papel/tarefa.

## Stack e decisões técnicas

- **Autenticação:** Clerk, usando apenas os recursos do plano gratuito (sem lógica customizada de senha/bloqueio além do que o Clerk já oferece).
- **Banco de dados:** Supabase, também restrito ao plano gratuito.
- **Documentação do módulo em desenvolvimento (`docs/`):** termo de abertura (TAP001_24), especificação (EP084_24), critérios de aceite (CA_UC01_01 a 05) e dicionário de dados (DC_EP084_24) do Módulo de Autenticação e Tela Principal.
- **Protótipos/wireframes:** criados de forma colaborativa diretamente na conversa (ex: via Artifact), não há arquivos de wireframe externos.

## Fluxo de trabalho Git

Decidido em 2026-08-08 (ADR informal, techlead-fsg): fluxo **híbrido por risco**, não "sempre PR" nem "sempre commit direto".

- **Direto na `master`:** documentação (`docs/*.md`), fix pequeno e localizado (poucas linhas, sem migration, sem mudar contrato de use case/Server Action).
- **Branch + Pull Request:** qualquer migration de banco, qualquer mudança em use case/regra de negócio financeira (empenho, liquidação, dotação, cálculo de impostos, etc.), e qualquer refatoração estrutural (mover/renomear muitos arquivos, criar/mudar layout compartilhado, mudar arquitetura de pastas). Nesses casos, a revisão antes do merge é o `/code-review` (não depende de revisão humana síncrona).
- **Critério de corte é julgamento, não checklist fechado** — na dúvida entre as duas categorias, tratar como risco mais alto (branch + PR).
- Justificativa: o CI (`.github/workflows/ci.yml`) já roda lint/tsc/test/build em push e em PR pra `master`, mas sem branch protection configurada, commit direto nunca aciona esse gate *antes* de ir pra produção — só avisa depois que já foi. Branch+PR reintroduz esse freio exatamente onde o risco financeiro é real, sem impor fricção a mudanças de baixo risco.

## Regra permanente e inegociável: cautela com comandos contra o banco de produção

Em 2026-08-14 um comando de diagnóstico Prisma (`migrate diff --shadow-database-url` apontado para a própria URL de produção como alvo E como shadow database) apagou **todos os dados de negócio de produção** (Propostas, Cargos, Empregados, Tabela Salarial, Alíquotas, etc.), sem backup disponível (plano free do Supabase, sem PITR). Recuperação foi só parcial (acesso/catálogo, via Clerk e seed) — o dado de negócio perdido é irrecuperável. Ver detalhes completos na memória `incidente_perda_dados_producao_2026_08_14.md`.

**A partir de agora, antes de executar QUALQUER comando (Prisma, SQL direto, script, MCP do Supabase) que toque o banco de produção — mesmo que pareça "só diagnóstico" ou "só leitura":**

1. Parar e explicitar, antes de rodar, se o comando pode escrever, apagar ou resetar dados — não assumir que um comando "de leitura/diagnóstico" é seguro só pelo nome (ex: `migrate diff` parece inofensivo mas não é).
2. Checar o valor literal de qualquer variável de conexão usada (`DATABASE_URL`, `SHADOW_DATABASE_URL`, `--shadow-database-url`, etc.) — nunca assumir que aponta pra onde deveria. `shadowDatabaseUrl`/`--shadow-database-url` NUNCA pode apontar para produção, sob nenhuma circunstância.
3. Se houver qualquer dúvida sobre o efeito do comando em produção, parar e perguntar ao usuário antes de executar, mesmo que isso pareça excesso de cautela.
4. Isso se soma (não substitui) ao fluxo Git híbrido acima — migrations continuam indo por branch+PR+`/code-review`, mas comandos ad-hoc de diagnóstico contra produção são uma categoria de risco à parte, que o fluxo de PR sozinho não cobre.
