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
