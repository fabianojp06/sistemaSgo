import type { PrismaClient, Prisma } from '@prisma/client';
import { TotalizerService } from '@/domain/plano-contas/TotalizerService';

export type AgrupadorComTotal = {
  id: string;
  nome: string;
  contaIds: string[];
  total: Prisma.Decimal;
};

/** RF_PLA_REQ_006 — Agrupadores com total calculado pelo TotalizerService. */
export class ListarAgrupadoresUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly totalizer: TotalizerService = new TotalizerService(),
  ) {}

  async execute(tenantId: string): Promise<AgrupadorComTotal[]> {
    const agrupadores = await this.prisma.contaAgrupadora.findMany({
      where: { tenantId },
      include: { itens: true },
      orderBy: { nome: 'asc' },
    });

    return Promise.all(
      agrupadores.map(async (agrupador) => {
        const contaIds = agrupador.itens.map((item) => item.contaId);
        return {
          id: agrupador.id,
          nome: agrupador.nome,
          contaIds,
          total: await this.totalizer.calcularTotal(contaIds),
        };
      }),
    );
  }
}
