import { Prisma, type PrismaClient } from '@prisma/client';
import { calcularCorSemaforo, LIMIARES_SEMAFORO_PADRAO, type CorSemaforo } from '@/domain/plano-contas/semaforoOrcamentario';

type ContaHierarquia = { id: string; idPai: string | null; isAnalitica: boolean };

/**
 * ADR-027 — nenhuma fonte de custo conhecida está sem contaId hoje. Mantido
 * como constante (em vez de excluir a lógica de `parcial`) para que a próxima
 * fonte de custo que nascer sem vínculo com ContaContabil vire `true` aqui,
 * em vez de o badge silenciosamente reportar 100% de cobertura de novo.
 */
const HA_FONTE_DE_CUSTO_SEM_CONTA_CONHECIDA = false;

export type BadgeSemaforoConta = {
  contaId: string;
  valorOrcado: Prisma.Decimal;
  valorRealizado: Prisma.Decimal;
  percentual: number | null; // null quando valorOrcado = 0 (sem base de comparação)
  cor: CorSemaforo | null;
  /**
   * US-008a — true quando valorRealizado desta conta (ou de algum descendente,
   * se sintética) não inclui todas as fontes de custo conhecidas do sistema.
   * Salvaguarda extensível: `FONTES_COBERTAS` lista as fontes já somadas em
   * `somarValorRealizadoPorConta`; se uma nova fonte de custo for adicionada
   * ao sistema sem ganhar vínculo com ContaContabil (repetindo o gap fechado
   * pela ADR-027), adicione-a como pendente aqui em vez de deixar o badge
   * mentir silenciosamente.
   */
  parcial: boolean;
};

/**
 * US-008a (ADR-013) + ADR-027 (2026-08-06) — Badge do Semáforo Orçamentário.
 *
 * ADR-027 fechou o gap original: Cargo/EmpregadoHeadcount (herdado do Cargo)
 * e RateioImpostoGrade ganharam `contaId` obrigatório, junto de Viagem e
 * ItemPatrimonial. As 4 fontes de custo hoje conhecidas no sistema estão
 * cobertas — `parcial` deixou de ser `true` fixo.
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

    // ADR-027 — Empregado não tem versaoId direto (escopado por Proposta); a
    // conta é o snapshot herdado do Cargo no momento do vínculo.
    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId, id: versaoId },
      select: { propostaId: true },
    });
    if (versao) {
      const empregados = await this.prisma.empregadoHeadcount.findMany({
        where: { tenantId, propostaId: versao.propostaId, ativo: true },
        select: { contaId: true, custoTotalMensal: true },
      });
      for (const empregado of empregados) {
        soma(empregado.contaId, empregado.custoTotalMensal);
      }
    }

    const rateiosImposto = await this.prisma.rateioImpostoGrade.findMany({
      where: { tenantId, versaoId, ativo: true },
      select: { contaId: true, valorDeclarado: true },
    });
    for (const rateio of rateiosImposto) {
      soma(rateio.contaId, rateio.valorDeclarado);
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
        realizado: valorRealizadoPorConta.get(contaId) ?? new Prisma.Decimal(0),
        parcial: HA_FONTE_DE_CUSTO_SEM_CONTA_CONHECIDA,
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
