import type { PrismaClient } from '@prisma/client';

/**
 * US-107 — próximo código candidato no formato CARGO-{ano}-{sequencial} (4
 * dígitos, reinicia por ano, único por tenant). Mesma estratégia de
 * gerarProximoCodigoProposta: sem lock explícito, colisões de concorrência são
 * resolvidas pelo retry no use-case chamador via @@unique([tenantId, codigoCargo]).
 */
export async function gerarProximoCodigoCargo(prisma: PrismaClient, tenantId: string, ano: number): Promise<string> {
  const prefixo = `CARGO-${ano}-`;

  const ultimoCargo = await prisma.cargo.findFirst({
    where: { tenantId, codigoCargo: { startsWith: prefixo } },
    orderBy: { codigoCargo: 'desc' },
    select: { codigoCargo: true },
  });

  const ultimoSequencial = ultimoCargo ? Number(ultimoCargo.codigoCargo.slice(prefixo.length)) : 0;
  const proximoSequencial = (Number.isNaN(ultimoSequencial) ? 0 : ultimoSequencial) + 1;

  return `${prefixo}${String(proximoSequencial).padStart(4, '0')}`;
}
