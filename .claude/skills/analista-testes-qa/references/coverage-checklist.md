# Checklist de Cobertura de Testes

Consulte este arquivo no **Coverage Mode** — ao revisar se uma feature ou módulo
tem cobertura de testes adequada.

---

## Mapa de cobertura por tipo de teste

Para cada feature do SGO 2.0, verificar a presença dos seguintes testes:

### Camada: Validação de entrada (Zod)
- [ ] Campo obrigatório ausente → erro com mensagem legível
- [ ] Tipo incorreto (string onde espera number) → erro
- [ ] Valor fora de range (negativo, zero, acima do limite) → erro
- [ ] Caracteres especiais / injeção → erro 422, não 500
- [ ] Payload vazio → erro
- [ ] Payload com campos extras → ignorado silenciosamente (não erro)

### Camada: Regra de negócio
- [ ] Caminho feliz com dados válidos → sucesso
- [ ] Saldo insuficiente → erro de negócio (não erro de servidor)
- [ ] Status inválido para a operação → erro descritivo
- [ ] Operação já realizada (idempotência) → comportamento correto definido
- [ ] Valores monetários no limite exato (ex: empenho = saldo exato) → sucesso
- [ ] Valores monetários com precisão decimal (ex: R$ 0,01) → sem erro de arredondamento

### Camada: Banco de dados (testes de integração)
- [ ] Estado do banco após operação de sucesso está correto
- [ ] Estado do banco após operação com erro permanece inalterado (rollback)
- [ ] Registro de auditoria criado após operação crítica
- [ ] Constraints de FK respeitadas
- [ ] Índices relevantes presentes (verificar EXPLAIN em queries de listagem)

### Camada: Multi-tenant (obrigatório em todas as features)
- [ ] Usuário do Tenant A não vê dados do Tenant B
- [ ] Operação do Tenant A não afeta dados do Tenant B
- [ ] Request sem orgId é rejeitada (401 ou 403)
- [ ] orgId adulterado no payload é ignorado (usa sempre o orgId do token Clerk)

### Camada: Autorização
- [ ] Admin pode executar a operação → sucesso
- [ ] Operador pode executar (se permitido) → sucesso
- [ ] Operador não pode executar (se restrito) → 403
- [ ] Auditor tem acesso apenas de leitura → tentativa de escrita retorna 403
- [ ] Usuário sem autenticação → redirecionado para login (não 500)

### Camada: UI / E2E
- [ ] Estado de loading visível durante operação assíncrona
- [ ] Mensagem de sucesso exibida após operação bem-sucedida
- [ ] Mensagem de erro legível exibida após falha (não "Erro interno")
- [ ] Estado vazio da lista tem feedback adequado
- [ ] Formulário é resetado ou atualizado após operação bem-sucedida
- [ ] Botão de submit é desabilitado durante o processamento (evitar duplo clique)

---

## Matriz de cobertura por módulo

Use esta matriz para mapear rapidamente o que está coberto:

| Feature / Módulo     | Unitário | Integração | E2E | Tenant | Auth | Status     |
|----------------------|----------|------------|-----|--------|------|------------|
| Criar dotação        | ⬜        | ⬜          | ⬜   | ⬜      | ⬜    | Não iniciado |
| Empenhar dotação     | ⬜        | ⬜          | ⬜   | ⬜      | ⬜    | Não iniciado |
| Liquidar empenho     | ⬜        | ⬜          | ⬜   | ⬜      | ⬜    | Não iniciado |
| Aprovar operação     | ⬜        | ⬜          | ⬜   | ⬜      | ⬜    | Não iniciado |
| Gerar relatório      | ⬜        | ⬜          | ⬜   | ⬜      | ⬜    | Não iniciado |

Legenda: ✅ Coberto | ⚠️ Parcial | ❌ Ausente (risco) | ⬜ Não mapeado

---

## Gaps críticos (priorizar imediatamente)

São gaps críticos que devem ser endereçados antes de qualquer release:

1. **Ausência de teste de isolamento de tenant** em qualquer feature que acessa banco
2. **Ausência de teste de rollback** em qualquer operação financeira
3. **Ausência de teste de idempotência** em endpoints/actions POST de operações financeiras
4. **Cobertura apenas de caminho feliz** em módulo financeiro — sem cenários de erro

---

## Meta de cobertura por nível

| Nível         | Meta mínima para release | Meta ideal |
|---------------|--------------------------|------------|
| Unitário      | 70% de linhas            | ≥ 85%      |
| Integração    | 100% dos fluxos P0/P1    | Todos os fluxos |
| E2E           | 100% dos fluxos críticos | Top 5 jornadas de usuário |
| Multi-tenant  | 100% das features        | 100% (sem exceção) |

A meta de cobertura de linhas (%) é indicativa — cobertura de 100% de linhas
com testes fracos é pior que 70% com testes que validam comportamento real.
Priorize cobertura de **comportamentos**, não de **linhas**.
