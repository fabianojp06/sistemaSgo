import { Prisma } from '@prisma/client';

type EmpregadoParaCronograma = {
  periodoInicio: Date;
  periodoFim: Date | null;
  valorSalarioSnapshot: Prisma.Decimal.Value;
  valorGratificacaoSnapshot: Prisma.Decimal.Value;
  valorEncargosSociaisSnapshot: Prisma.Decimal.Value;
  valorValeAlimentacaoSnapshot: Prisma.Decimal.Value;
  valorValeRefeicaoSnapshot: Prisma.Decimal.Value;
  valorValeTransporteSnapshot: Prisma.Decimal.Value;
  valorPlanoOdontologicoSnapshot: Prisma.Decimal.Value;
  valorSeguroVidaSnapshot: Prisma.Decimal.Value;
  valorPlanoSaudeSnapshot: Prisma.Decimal.Value;
  valorAuxilioCrecheSnapshot: Prisma.Decimal.Value;
};

type ItemPatrimonialParaCronograma = { data: Date; valorTotal: Prisma.Decimal.Value };
type RateioParaCronograma = { competencia: Date; valorDeclarado: Prisma.Decimal.Value };
type ViagemParaCronograma = { custoEstimado: Prisma.Decimal.Value };

export type LinhaCronograma = {
  mes: number; // 1-indexed dentro da vigência da Proposta
  competencia: Date; // primeiro dia do mês
  desembolsoMensal: Prisma.Decimal;
  desembolsoAcumulado: Prisma.Decimal;
  percentualFinanceiroAcumulado: Prisma.Decimal; // RN0252 — 2 casas, half-even
  valorRepassado12Meses: Prisma.Decimal | null; // RN0253 — só nos múltiplos de 12
};

function primeiroDiaDoMes(ano: number, mesIndex0: number): Date {
  return new Date(Date.UTC(ano, mesIndex0, 1));
}

function mesmoMes(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

function somarComponentesEmpregado(e: EmpregadoParaCronograma): Prisma.Decimal {
  return [
    e.valorSalarioSnapshot,
    e.valorGratificacaoSnapshot,
    e.valorEncargosSociaisSnapshot,
    e.valorValeAlimentacaoSnapshot,
    e.valorValeRefeicaoSnapshot,
    e.valorValeTransporteSnapshot,
    e.valorPlanoOdontologicoSnapshot,
    e.valorSeguroVidaSnapshot,
    e.valorPlanoSaudeSnapshot,
    e.valorAuxilioCrecheSnapshot,
  ].reduce((acc: Prisma.Decimal, v) => acc.plus(v), new Prisma.Decimal(0));
}

/**
 * US-122/UC04.01 [ORIGEM BLINDADA] — distribui o custo da Proposta mês a mês
 * dentro de [dataInicio, dataFim], reaproveitando as mesmas fontes de
 * ValorRealizadoService (Empregado, Viagem, ItemPatrimonial,
 * RateioImpostoGrade), mas por competência em vez de total único:
 * - Empregado: soma de todos os componentes de snapshot, em cada mês cujo
 *   período [periodoInicio, periodoFim ?? dataFim da Proposta] cobre.
 * - ItemPatrimonial/RateioImpostoGrade: valor total no mês exato do campo
 *   de data (`data`/`competencia`).
 * - Viagem [LIMITAÇÃO CONHECIDA]: o modelo não guarda "quando" a viagem
 *   ocorre (sem campo de data) — custoEstimado inteiro é atribuído ao
 *   PRIMEIRO mês da vigência da Proposta. Decisão explícita do Tech Lead
 *   (ADR referenciado em US-122), não é bug.
 */
export function montarCronogramaDesembolso(
  proposta: { dataInicio: Date; dataFim: Date },
  empregados: EmpregadoParaCronograma[],
  viagens: ViagemParaCronograma[],
  itens: ItemPatrimonialParaCronograma[],
  rateios: RateioParaCronograma[],
): LinhaCronograma[] {
  const meses: Date[] = [];
  let cursor = primeiroDiaDoMes(proposta.dataInicio.getUTCFullYear(), proposta.dataInicio.getUTCMonth());
  const limite = primeiroDiaDoMes(proposta.dataFim.getUTCFullYear(), proposta.dataFim.getUTCMonth());
  while (cursor.getTime() <= limite.getTime()) {
    meses.push(cursor);
    cursor = primeiroDiaDoMes(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1);
  }

  const custoTotalViagens = viagens.reduce((acc, v) => acc.plus(v.custoEstimado), new Prisma.Decimal(0));

  const desembolsosMensais = meses.map((competencia, indice) => {
    let total = new Prisma.Decimal(0);

    for (const empregado of empregados) {
      const fimEmpregado = empregado.periodoFim ?? proposta.dataFim;
      const cobreOMes =
        empregado.periodoInicio.getTime() <= new Date(Date.UTC(competencia.getUTCFullYear(), competencia.getUTCMonth() + 1, 0)).getTime() &&
        fimEmpregado.getTime() >= competencia.getTime();
      if (cobreOMes) total = total.plus(somarComponentesEmpregado(empregado));
    }

    for (const item of itens) {
      if (mesmoMes(item.data, competencia)) total = total.plus(item.valorTotal);
    }

    for (const rateio of rateios) {
      if (mesmoMes(rateio.competencia, competencia)) total = total.plus(rateio.valorDeclarado);
    }

    if (indice === 0) total = total.plus(custoTotalViagens);

    return total;
  });

  const custoTotalGlobal = desembolsosMensais.reduce((acc, v) => acc.plus(v), new Prisma.Decimal(0));

  let acumulado = new Prisma.Decimal(0);
  return desembolsosMensais.map((desembolsoMensal, indice) => {
    acumulado = acumulado.plus(desembolsoMensal);
    const mes = indice + 1;
    const percentual = custoTotalGlobal.isZero()
      ? new Prisma.Decimal(0)
      : acumulado.dividedBy(custoTotalGlobal).times(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);

    const valorRepassado12Meses =
      mes % 12 === 0
        ? desembolsosMensais.slice(mes - 12, mes).reduce((acc, v) => acc.plus(v), new Prisma.Decimal(0))
        : null;

    return {
      mes,
      competencia: meses[indice],
      desembolsoMensal,
      desembolsoAcumulado: acumulado,
      percentualFinanceiroAcumulado: percentual,
      valorRepassado12Meses,
    };
  });
}
