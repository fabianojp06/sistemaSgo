import { Prisma, type PrismaClient } from '@prisma/client';

type ContaHierarquia = { id: string; idPai: string | null; isAnalitica: boolean };

/**
 * US-007, RN_PLA_012 — total de uma conta sintética é sempre a soma recursiva
 * de suas folhas analíticas descendentes, na mesma versão+exercício. Não é
 * persistido nesta primeira versão (ADR-011/012): calculado sob demanda.
 */
export class ValorOrcadoTotalizerService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Calcula o total de cada conta em `contaIds` (analítica ou sintética) para a
   * versão+exercício informados. Contas analíticas retornam seu próprio valor
   * lançado (ou zero, se não configurado); sintéticas retornam a soma de todas
   * as folhas descendentes.
   */
  async calcularTotais(
    tenantId: string,
    versaoId: string,
    exercicio: number,
    contaIds: string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    const todasContas = await this.prisma.contaContabil.findMany({
      where: { tenantId },
      select: { id: true, idPai: true, isAnalitica: true },
    });
    const porId = new Map(todasContas.map((c) => [c.id, c]));

    const valoresLancados = await this.prisma.valorOrcadoConta.findMany({
      where: { tenantId, versaoId, exercicio },
      select: { contaId: true, valor: true },
    });
    const valorPorConta = new Map(valoresLancados.map((v) => [v.contaId, v.valor]));

    const filhasPorPai = new Map<string, ContaHierarquia[]>();
    for (const conta of todasContas) {
      if (conta.idPai === null) continue;
      const lista = filhasPorPai.get(conta.idPai) ?? [];
      lista.push(conta);
      filhasPorPai.set(conta.idPai, lista);
    }

    const resultado = new Map<string, Prisma.Decimal>();
    for (const contaId of contaIds) {
      resultado.set(contaId, this.somarFolhasDescendentes(contaId, porId, filhasPorPai, valorPorConta));
    }
    return resultado;
  }

  private somarFolhasDescendentes(
    contaId: string,
    porId: Map<string, ContaHierarquia>,
    filhasPorPai: Map<string, ContaHierarquia[]>,
    valorPorConta: Map<string, Prisma.Decimal>,
  ): Prisma.Decimal {
    const conta = porId.get(contaId);
    if (!conta) return new Prisma.Decimal(0);

    if (conta.isAnalitica) {
      return valorPorConta.get(contaId) ?? new Prisma.Decimal(0);
    }

    const filhas = filhasPorPai.get(contaId) ?? [];
    return filhas.reduce(
      (acc, filha) => acc.plus(this.somarFolhasDescendentes(filha.id, porId, filhasPorPai, valorPorConta)),
      new Prisma.Decimal(0),
    );
  }

  /** Retorna, em ordem da folha até a raiz, os IDs das contas sintéticas ancestrais de `contaId`. */
  async obterAncestrais(tenantId: string, contaId: string): Promise<string[]> {
    const todasContas = await this.prisma.contaContabil.findMany({
      where: { tenantId },
      select: { id: true, idPai: true },
    });
    const porId = new Map(todasContas.map((c) => [c.id, c]));

    const ancestrais: string[] = [];
    let idAtual = porId.get(contaId)?.idPai ?? null;
    while (idAtual) {
      ancestrais.push(idAtual);
      idAtual = porId.get(idAtual)?.idPai ?? null;
    }
    return ancestrais;
  }
}
