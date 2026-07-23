# Transaction Patterns — SGO 2.0
 
Referência para o **Tx Mode**: operações financeiras críticas.
 
## Regra de Ouro
 
> Empenho e liquidação nunca podem quebrar no meio.
> Se uma etapa falha, todas as anteriores fazem rollback automaticamente.
> **Sempre `prisma.$transaction()`** para qualquer operação que altere saldo.
 
---
 
## Nível de Isolamento por Operação
 
| Operação                              | `isolationLevel`   | Motivo                                       |
|---------------------------------------|--------------------|----------------------------------------------|
| Empenhar dotação                      | `Serializable`     | Evitar double-spend do mesmo saldo           |
| Liquidar empenho                      | `Serializable`     | Valor liquidado ≤ valor empenhado            |
| Consultar saldo (read-only)           | `ReadCommitted`    | Padrão; sem risco de escrita                 |
| Cancelar / estornar                   | `RepeatableRead`   | Garantir estado consistente durante o cancel |
| Aprovação de workflow                 | `RepeatableRead`   | Ler status antes de transitar                |
 
---
 
## Template: Empenhar Dotação
 
```typescript
export async function empenharDotacao(input: EmpenharInput, orgId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
 
    // 1. Buscar e travar dotação (pessimistic lock via raw)
    const [dotacao] = await tx.$queryRaw<Dotacao[]>`
      SELECT * FROM "Dotacao"
      WHERE id = ${input.dotacaoId}
        AND "orgId" = ${orgId}
        AND status = 'ATIVA'
      FOR UPDATE
    `
    if (!dotacao) throw new Error('Dotação não encontrada ou inativa')
 
    // 2. Validar saldo
    const saldo = new Prisma.Decimal(dotacao.saldoDisponivel)
    const valor = new Prisma.Decimal(input.valor)
    if (saldo.lessThan(valor)) {
      throw new Error(`Saldo insuficiente: disponível ${saldo}, solicitado ${valor}`)
    }
 
    // 3. Debitar saldo da dotação
    await tx.dotacao.update({
      where: { id: dotacao.id },
      data: {
        saldoDisponivel: { decrement: valor },
        atualizadoPor: userId,
      },
    })
 
    // 4. Criar empenho
    const empenho = await tx.empenho.create({
      data: {
        orgId,
        dotacaoId: dotacao.id,
        numero: await gerarNumeroEmpenho(tx, orgId),
        descricao: input.descricao,
        valor,
        criadoPor: userId,
      },
    })
 
    // 5. Registrar auditoria (dentro da mesma transação)
    await tx.logAuditoria.create({
      data: {
        orgId,
        entidade: 'Empenho',
        entidadeId: empenho.id,
        operacao: 'CRIAR',
        dadosNovos: JSON.stringify(empenho),
        realizadoPor: userId,
      },
    })
 
    return empenho
 
  }, { isolationLevel: 'Serializable' })
}
```
 
---
 
## Template: Liquidar Empenho
 
```typescript
export async function liquidarEmpenho(input: LiquidarInput, orgId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
 
    // 1. Buscar empenho com lock
    const [empenho] = await tx.$queryRaw<Empenho[]>`
      SELECT * FROM "Empenho"
      WHERE id = ${input.empenhoId}
        AND "orgId" = ${orgId}
        AND status = 'APROVADO'
      FOR UPDATE
    `
    if (!empenho) throw new Error('Empenho não encontrado ou não está aprovado')
 
    // 2. Calcular total já liquidado
    const { _sum } = await tx.liquidacao.aggregate({
      where: { empenhoId: empenho.id, status: { not: 'ESTORNADA' } },
      _sum: { valor: true },
    })
    const totalLiquidado = _sum.valor ?? new Prisma.Decimal(0)
    const valorEmpenho = new Prisma.Decimal(empenho.valor)
    const valorNovo = new Prisma.Decimal(input.valor)
 
    if (totalLiquidado.plus(valorNovo).greaterThan(valorEmpenho)) {
      throw new Error('Valor de liquidação ultrapassa o saldo do empenho')
    }
 
    // 3. Criar liquidação
    const liquidacao = await tx.liquidacao.create({
      data: {
        orgId,
        empenhoId: empenho.id,
        valor: valorNovo,
        criadoPor: userId,
      },
    })
 
    // 4. Se totalmente liquidado, atualizar status do empenho
    if (totalLiquidado.plus(valorNovo).equals(valorEmpenho)) {
      await tx.empenho.update({
        where: { id: empenho.id },
        data: { status: 'LIQUIDADO', atualizadoPor: userId },
      })
    }
 
    return liquidacao
 
  }, { isolationLevel: 'Serializable' })
}
```
 
---
 
## Template: Estorno / Cancelamento
 
```typescript
export async function cancelarEmpenho(empenhoId: string, orgId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
 
    // 1. Buscar empenho com lock
    const [empenho] = await tx.$queryRaw<Empenho[]>`
      SELECT e.*, d."saldoDisponivel" as "dotacaoSaldo"
      FROM "Empenho" e
      JOIN "Dotacao" d ON d.id = e."dotacaoId"
      WHERE e.id = ${empenhoId}
        AND e."orgId" = ${orgId}
        AND e.status IN ('PENDENTE', 'APROVADO')
      FOR UPDATE
    `
    if (!empenho) throw new Error('Empenho não pode ser cancelado neste estado')
 
    // 2. Estornar saldo para a dotação
    await tx.dotacao.update({
      where: { id: empenho.dotacaoId },
      data: {
        saldoDisponivel: { increment: empenho.valor },
        atualizadoPor: userId,
      },
    })
 
    // 3. Cancelar empenho (nunca deletar — manter histórico)
    return tx.empenho.update({
      where: { id: empenho.id },
      data: { status: 'CANCELADO', atualizadoPor: userId },
    })
 
  }, { isolationLevel: 'RepeatableRead' })
}
```
 
---
 
## Erro de Conflito: Retry com Backoff
 
Para `Serializable`, conflitos de serialização geram `P2034`. Implementar retry:
 
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      // P2034 = transaction conflict (serialization failure)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < maxAttempts
      ) {
        await new Promise(r => setTimeout(r, attempt * 100)) // backoff
        continue
      }
      throw error
    }
  }
  throw new Error('Máximo de tentativas atingido')
}
 
// Uso
const empenho = await withRetry(() => empenharDotacao(input, orgId, userId))
```
 
---
 
## Anti-Patterns Críticos
 
```typescript
// ❌ Duas operações independentes — se a segunda falhar, saldo fica errado
await prisma.dotacao.update({ data: { saldoDisponivel: { decrement: valor } } })
await prisma.empenho.create({ data: { /* ... */ } })
 
// ❌ Ler e escrever sem lock — race condition entre dois empenhos simultâneos
const dotacao = await prisma.dotacao.findUnique({ where: { id } })
if (dotacao.saldoDisponivel >= valor) {
  await prisma.dotacao.update({ ... }) // outro processo pode ter chegado aqui antes
}
 
// ❌ Usar Float — perde precisão em valores grandes
valor: 10000.01 // pode virar 10000.009999999 no Float
 
// ❌ Deletar registro financeiro — nunca
await prisma.empenho.delete({ where: { id } }) // use status 'CANCELADO'
```
 