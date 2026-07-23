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

Ao planejar ou executar tarefas do projeto, considere qual papel é mais adequado para a tarefa e invoque a skill correspondente quando fizer sentido.

## Stack e decisões técnicas

- **Autenticação:** Clerk, usando apenas os recursos do plano gratuito (sem lógica customizada de senha/bloqueio além do que o Clerk já oferece).
- **Banco de dados:** Supabase, também restrito ao plano gratuito.
- **Documentação do módulo em desenvolvimento (`docs/`):** termo de abertura (TAP001_24), especificação (EP084_24), critérios de aceite (CA_UC01_01 a 05) e dicionário de dados (DC_EP084_24) do Módulo de Autenticação e Tela Principal.
- **Protótipos/wireframes:** criados de forma colaborativa diretamente na conversa (ex: via Artifact), não há arquivos de wireframe externos.
