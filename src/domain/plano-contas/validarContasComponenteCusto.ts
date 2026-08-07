import type { PrismaClient } from '@prisma/client';
import { ContaComponenteCustoNaoAnaliticaError } from '@/domain/plano-contas/errors';

/**
 * ADR-029 — valida um conjunto de contas analíticas opcionais (uma por
 * componente de custo do Cargo). Cada entrada com id não-null precisa
 * existir, pertencer ao tenant e ser analítica; entradas null são puladas
 * (componente sem conta configurada ainda).
 */
export async function validarContasComponenteCusto(
  prisma: PrismaClient,
  tenantId: string,
  contas: Record<string, { id: string | null | undefined; label: string }>,
): Promise<void> {
  const idsParaValidar = Object.values(contas)
    .map((c) => c.id)
    .filter((id): id is string => !!id);
  if (idsParaValidar.length === 0) return;

  const encontradas = await prisma.contaContabil.findMany({
    where: { tenantId, id: { in: idsParaValidar } },
    select: { id: true, isAnalitica: true },
  });
  const analiticaPorId = new Map(encontradas.map((c) => [c.id, c.isAnalitica]));

  for (const { id, label } of Object.values(contas)) {
    if (!id) continue;
    if (!analiticaPorId.get(id)) {
      throw new ContaComponenteCustoNaoAnaliticaError(label);
    }
  }
}
