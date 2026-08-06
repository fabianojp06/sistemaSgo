import type { PrismaClient } from '@prisma/client';

/**
 * US-113 — próximo número de documento candidato no formato "C-{sequencial}"
 * (3 dígitos, reinicia por Proposta, único por tenant+Proposta). Mesma
 * estratégia de gerarProximoCodigoCargo/gerarProximoCodigoProposta: sem lock
 * explícito, colisões de concorrência são resolvidas pelo retry no use-case
 * chamador via @@unique([tenantId, propostaId, numeroDocumento]).
 */
export async function gerarProximoNumeroDocumentoQtdeEmpregado(
  prisma: PrismaClient,
  tenantId: string,
  propostaId: string,
): Promise<string> {
  const prefixo = 'C-';

  const ultimoDocumento = await prisma.qtdeEmpregado.findFirst({
    where: { tenantId, propostaId, numeroDocumento: { startsWith: prefixo } },
    orderBy: { numeroDocumento: 'desc' },
    select: { numeroDocumento: true },
  });

  const ultimoSequencial = ultimoDocumento ? Number(ultimoDocumento.numeroDocumento.slice(prefixo.length)) : 0;
  const proximoSequencial = (Number.isNaN(ultimoSequencial) ? 0 : ultimoSequencial) + 1;

  return `${prefixo}${String(proximoSequencial).padStart(3, '0')}`;
}
