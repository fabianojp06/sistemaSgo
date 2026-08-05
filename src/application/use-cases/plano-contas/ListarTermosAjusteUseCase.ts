import type { Prisma, PrismaClient } from '@prisma/client';

export type TermoAjusteListado = {
  id: string;
  contaOrigemLabel: string;
  contaDestinoLabel: string;
  exercicio: number;
  valor: Prisma.Decimal;
  status: string;
  updatedAt: Date;
};

/** US-111 — lista os Termos de Ajuste de uma Versão de Proposta, mais recentes primeiro. */
export class ListarTermosAjusteUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(tenantId: string, versaoId: string): Promise<TermoAjusteListado[]> {
    const termos = await this.prisma.termoAjuste.findMany({
      where: { tenantId, versaoId },
      include: { contaOrigem: true, contaDestino: true },
      orderBy: { updatedAt: 'desc' },
    });

    return termos.map((termo) => ({
      id: termo.id,
      contaOrigemLabel: `${termo.contaOrigem.codigoErp} — ${termo.contaOrigem.nomeConta}`,
      contaDestinoLabel: `${termo.contaDestino.codigoErp} — ${termo.contaDestino.nomeConta}`,
      exercicio: termo.exercicio,
      valor: termo.valor,
      status: termo.status,
      updatedAt: termo.updatedAt,
    }));
  }
}
