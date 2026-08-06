import { Prisma, type PrismaClient } from '@prisma/client';
import { calcularCorSemaforo, LIMIARES_SEMAFORO_PADRAO, type CorSemaforo } from '@/domain/plano-contas/semaforoOrcamentario';

type ContaHierarquia = { id: string; idPai: string | null; isAnalitica: boolean };

export type BadgeSemaforoConta = {
  contaId: string;
  valorOrcado: Prisma.Decimal;
  valorRealizado: Prisma.Decimal;
  percentual: number | null; // null quando valorOrcado = 0 (sem base de comparação)
  cor: CorSemaforo | null;
  /**
   * US-008a — verdadeiro enquanto valorRealizado não incluir Empregados nem
   * Rateio de Impostos (ver nota no topo do arquivo). Herdado por contas
   * sintéticas se qualquer folha descendente estiver parcial.
   */
  parcial: boolean;
};

/**
 * US-008a (ADR-013, decisão AN/PO 2026-08-06) — Badge do Semáforo Orçamentário.
 *
 * ACHADO DE IMPLEMENTAÇÃO (reportado ao Tech Lead/AN-PO): a decisão de produto
 * previa somar Empregado + Viagem + ItemPatrimonial + RateioImpostoGrade por
 * `contaId`. Na prática, só `Viagem` (contaPassagem/contaDiaria/contaTransporte)
 * e `ItemPatrimonial.contaId` têm vínculo com `ContaContabil` no schema atual.
 * `EmpregadoHeadcount`/`Cargo` só se vinculam a `UnidadeFuncional` (organograma,
 * ADR-015), nunca a `ContaContabil`; `RateioImpostoGrade` é escopado só por
 * `versaoId`, sem `contaId`. Por isso `valorRealizado` aqui soma apenas
 * Viagem+ItemPatrimonial, e `parcial` é sempre `true` até uma ADR decidir como
 * (ou se) atribuir custo de Empregados e Rateio de Impostos a uma conta
 * analítica específica.
 */
export class CalcularValorRealizadoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    tenantId: string,
    versaoId: string,
    contaIds: string[],
  ): Promise<Map<string, BadgeSemaforoConta>> {
    const todasContas = await this.prisma.contaContabil.findMany({
      where: { tenantId },
      select: {
        id: true,
        idPai: true,
        isAnalitica: true,
        semaforoVerdePct: true,
        semaforoAmareloPct: true,
        semaforoLaranjaPct: true,
      },
    });
    const porId = new Map(todasContas.map((c) => [c.id, c]));
    const filhasPorPai = new Map<string, ContaHierarquia[]>();
    for (const conta of todasContas) {
      if (conta.idPai === null) continue;
      const lista = filhasPorPai.get(conta.idPai) ?? [];
      lista.push(conta);
      filhasPorPai.set(conta.idPai, lista);
    }

    const valorOrcadoPorConta = await this.somarValorOrcadoPorConta(tenantId, versaoId);
    const valorRealizadoPorConta = await this.somarValorRealizadoPorConta(tenantId, versaoId);

    const resultado = new Map<string, BadgeSemaforoConta>();
    for (const contaId of contaIds) {
      const { orcado, realizado, parcial } = this.agregar(
        contaId,
        porId,
        filhasPorPai,
        valorOrcadoPorConta,
        valorRealizadoPorConta,
      );

      const conta = porId.get(contaId);
      const limiares =
        conta?.semaforoVerdePct != null && conta?.semaforoAmareloPct != null && conta?.semaforoLaranjaPct != null
          ? { verde: conta.semaforoVerdePct, amarelo: conta.semaforoAmareloPct, laranja: conta.semaforoLaranjaPct }
          : LIMIARES_SEMAFORO_PADRAO;

      const percentual = orcado.isZero() ? null : realizado.dividedBy(orcado).times(100).toNumber();

      resultado.set(contaId, {
        contaId,
        valorOrcado: orcado,
        valorRealizado: realizado,
        percentual,
        cor: percentual === null ? null : calcularCorSemaforo(percentual, limiares),
        parcial,
      });
    }
    return resultado;
  }

  private async somarValorOrcadoPorConta(tenantId: string, versaoId: string): Promise<Map<string, Prisma.Decimal>> {
    const linhas = await this.prisma.valorOrcadoConta.findMany({
      where: { tenantId, versaoId },
      select: { contaId: true, valor: true },
    });
    const porConta = new Map<string, Prisma.Decimal>();
    for (const linha of linhas) {
      porConta.set(linha.contaId, (porConta.get(linha.contaId) ?? new Prisma.Decimal(0)).plus(linha.valor));
    }
    return porConta;
  }

  private async somarValorRealizadoPorConta(tenantId: string, versaoId: string): Promise<Map<string, Prisma.Decimal>> {
    const porConta = new Map<string, Prisma.Decimal>();
    const soma = (contaId: string, valor: Prisma.Decimal) =>
      porConta.set(contaId, (porConta.get(contaId) ?? new Prisma.Decimal(0)).plus(valor));

    const viagens = await this.prisma.viagem.findMany({
      where: { tenantId, versaoId, ativo: true },
      select: {
        contaPassagemId: true,
        contaDiariaId: true,
        contaTransporteId: true,
        quantidadePessoas: true,
        mediaDias: true,
        custoUnitarioPassagem: true,
        custoUnitarioDiaria: true,
        custoUnitarioTransporte: true,
      },
    });
    for (const v of viagens) {
      soma(v.contaPassagemId, v.custoUnitarioPassagem.times(v.quantidadePessoas));
      soma(v.contaDiariaId, v.custoUnitarioDiaria.times(v.quantidadePessoas).times(v.mediaDias));
      soma(v.contaTransporteId, v.custoUnitarioTransporte.times(v.quantidadePessoas));
    }

    const itens = await this.prisma.itemPatrimonial.findMany({
      where: { tenantId, versaoId, ativo: true },
      select: { contaId: true, valorTotal: true },
    });
    for (const item of itens) {
      soma(item.contaId, item.valorTotal);
    }

    return porConta;
  }

  private agregar(
    contaId: string,
    porId: Map<string, ContaHierarquia>,
    filhasPorPai: Map<string, ContaHierarquia[]>,
    valorOrcadoPorConta: Map<string, Prisma.Decimal>,
    valorRealizadoPorConta: Map<string, Prisma.Decimal>,
  ): { orcado: Prisma.Decimal; realizado: Prisma.Decimal; parcial: boolean } {
    const conta = porId.get(contaId);
    if (!conta) return { orcado: new Prisma.Decimal(0), realizado: new Prisma.Decimal(0), parcial: true };

    if (conta.isAnalitica) {
      return {
        orcado: valorOrcadoPorConta.get(contaId) ?? new Prisma.Decimal(0),
        // ACHADO: sempre parcial — Empregados e Rateio de Impostos não são
        // atribuíveis a uma ContaContabil no schema atual (ver comentário da classe).
        realizado: valorRealizadoPorConta.get(contaId) ?? new Prisma.Decimal(0),
        parcial: true,
      };
    }

    const filhas = filhasPorPai.get(contaId) ?? [];
    const inicial: { orcado: Prisma.Decimal; realizado: Prisma.Decimal; parcial: boolean } = {
      orcado: new Prisma.Decimal(0),
      realizado: new Prisma.Decimal(0),
      parcial: false,
    };
    return filhas.reduce((acc, filha) => {
      const sub = this.agregar(filha.id, porId, filhasPorPai, valorOrcadoPorConta, valorRealizadoPorConta);
      return {
        orcado: acc.orcado.plus(sub.orcado),
        realizado: acc.realizado.plus(sub.realizado),
        parcial: acc.parcial || sub.parcial,
      };
    }, inicial);
  }
}
