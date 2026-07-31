import type { PrismaClient } from '@prisma/client';

/**
 * US-102/US-104 — próximo código candidato no formato PROP-{ano}-{sequencial}
 * (4 dígitos, reinicia por ano, único por tenant). Não há lock explícito;
 * colisões de concorrência são resolvidas pelo retry no use-case chamador
 * via @@unique([tenantId, codigo]).
 */
export async function gerarProximoCodigoProposta(prisma: PrismaClient, tenantId: string, ano: number): Promise<string> {
  const prefixo = `PROP-${ano}-`;

  const ultimaProposta = await prisma.proposta.findFirst({
    where: { tenantId, codigo: { startsWith: prefixo } },
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  });

  const ultimoSequencial = ultimaProposta ? Number(ultimaProposta.codigo.slice(prefixo.length)) : 0;
  const proximoSequencial = (Number.isNaN(ultimoSequencial) ? 0 : ultimoSequencial) + 1;

  return `${prefixo}${String(proximoSequencial).padStart(4, '0')}`;
}

export function isUniqueConstraintError(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    (erro as { code?: string }).code === 'P2002'
  );
}
