import type { PrismaClient } from '@prisma/client';

const LIMITE_RESULTADOS = 20;

export type CandidatoCargoMercado = {
  codigoOrigem: string;
  nome: string;
};

/**
 * ADR-047 (US-139) — busca por substring (case-insensitive) no Catálogo de
 * Cargo de Mercado. Sem paginação (catálogo pequeno, ~180 linhas) — limitado
 * a 20 resultados só para não estourar a UI com um termo muito genérico.
 */
export class BuscarCargoMercadoCatalogoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(tenantId: string, termo: string): Promise<CandidatoCargoMercado[]> {
    const termoNormalizado = termo.trim();
    if (termoNormalizado.length < 2) {
      return [];
    }

    const registros = await this.prisma.cargoMercadoCatalogo.findMany({
      where: {
        tenantId,
        nome: { contains: termoNormalizado, mode: 'insensitive' },
      },
      orderBy: { nome: 'asc' },
      take: LIMITE_RESULTADOS,
      select: { codigoOrigem: true, nome: true },
    });

    return registros;
  }
}
