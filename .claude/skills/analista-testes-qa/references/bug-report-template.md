# Template de Bug Report

Consulte este arquivo no **Bug Mode** — ao documentar, analisar ou priorizar defeitos.

---

## Template completo

```markdown
# BUG-[NNN]: [Título descritivo — o que está errado, não o que deveria ser]

**Data**: [data]
**Reportado por**: [QA / Dev / Usuário]
**Módulo SGO**: [Dotações / Empenhos / Liquidações / Aprovações / Relatórios / Auth]
**Severidade**: P0 / P1 / P2 / P3
**Status**: Aberto / Em análise / Em correção / Aguardando verificação / Fechado
**Versão/Build**: [hash do commit ou versão de deploy]

---

## Descrição

[Uma frase clara descrevendo o comportamento incorreto observado.
Não descreva o que deveria acontecer aqui — isso vai na seção Resultado Esperado.]

---

## Passos para reproduzir

**Pré-condições:**
- Ambiente: [homologação / local / produção]
- Tenant: [orgId do tenant usado no teste]
- Usuário: [perfil — Admin / Operador / Auditor]
- Estado do banco: [ex: "dotação com saldo de R$ 10.000, nenhum empenho anterior"]

**Passos:**
1. Acessar [URL específica]
2. [ação exata do usuário]
3. [próxima ação]
4. Observar [onde o problema aparece]

---

## Resultado obtido

[O que realmente aconteceu — seja específico: mensagem de erro exata, valor incorreto
retornado, estado incorreto no banco, redirecionamento inesperado.]

```
Exemplo de resposta da API recebida:
{ "error": null, "data": { "valorEmpenhado": "0.00" } }
// sendo que o banco mostra valorEmpenhado = 3000.00
```

---

## Resultado esperado

[O que deveria ter acontecido segundo os critérios de aceite.
Referenciar a User Story ou requisito quando disponível: "Conforme CT-007 / US-012".]

---

## Evidências

- [ ] Screenshot ou vídeo da tela
- [ ] Log de console (F12 → Console)
- [ ] Log do servidor (terminal / Vercel logs)
- [ ] Payload da request (F12 → Network → request body)
- [ ] Estado do banco antes e depois (query SQL + resultado)

---

## Hipótese de causa raiz

[Análise inicial do QA sobre onde está o problema. Não precisa ser definitiva —
é ponto de partida para o Dev. Exemplos:]

- [ ] Validação ausente na Server Action (apenas no cliente)
- [ ] Falta de lock otimista — race condition em operação concorrente
- [ ] Filtro de tenant ausente na query Prisma
- [ ] Rollback não acionado em caso de erro parcial
- [ ] Cache desatualizado após mutação

---

## Impacto

**Frequência**: [Sempre / Às vezes / Raramente / Apenas com dados específicos]
**Usuários afetados**: [Todos / Admins / Operadores / Tenant específico]
**Impacto financeiro**: [Sim / Não / Potencial] — [descrição se sim]
**Risco de dados**: [Corrupção / Perda / Exposição cross-tenant / Nenhum]

---

## Teste de regressão sugerido

[Descrever o caso de teste que deve ser adicionado à suíte de automação após a correção,
para garantir que o bug não volte. Especificar nível: unitário, integração ou E2E.]

```typescript
// Exemplo de teste de regressão a adicionar
it('não permite empenho quando dotação está bloqueada', async () => {
  // setup...
  // execução...
  // asserção...
})
```
```

---

## Guia de severidade para o SGO 2.0

| Severidade | Critério | Exemplos |
|------------|----------|----------|
| **P0 — Crítico** | Corrupção de dados financeiros, vazamento cross-tenant, sistema inacessível | Empenho duplicado, saldo errado, dados de outro tenant visíveis |
| **P1 — Alto** | Fluxo principal bloqueado sem workaround | Não consegue criar empenho, aprovação não funciona |
| **P2 — Médio** | Fluxo funciona mas com comportamento incorreto ou workaround disponível | Valor exibido com formatação errada, paginação incorreta |
| **P3 — Baixo** | Problema visual ou de UX sem impacto funcional | Alinhamento, texto de botão, cor incorreta |

**Regra inviolável**: qualquer bug que afete integridade financeira (empenho, liquidação, saldo,
dotação) ou isolamento de tenant é **P0**, independente de qualquer outro critério.

---

## Ciclo de vida do bug

```
Aberto (QA)
  → Em análise (Dev) — 24h para P0, 48h para P1
    → Em correção (Dev)
      → Aguardando verificação (Dev → QA)
        → Fechado (QA confirma correção + teste de regressão adicionado)
        → Reaberto (QA não confirma — volta para Em correção)
```

P0 deve ter alerta imediato no canal do time. Nunca deixar P0 aberto sem responsável definido.
