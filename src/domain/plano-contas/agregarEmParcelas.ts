import { Prisma } from '@prisma/client';
import type { LinhaCronograma } from './montarCronogramaDesembolso';
import { gerarDatasParcela, type ConfigCalendarioRepasse } from './gerarDatasParcela';

/**
 * US-142 / ADR-049 §B — camada de agregação por cima do motor mensal
 * (`montarCronogramaDesembolso`, que NÃO muda). Transforma as linhas mês a mês
 * em parcelas T1..Tn no layout ANEXO 9, com subtotais por ano civil e total geral.
 *
 * [ORIGEM BLINDADA] — função pura, sem I/O.
 *
 * - Período coberto por cada parcela é ANTECIPADO: Tk paga o bloco
 *   [Dk, mês anterior a D(k+1)]; a última parcela cobre até o mês de dataFim.
 * - RN0252 — % Financeiro Acumulado = acumulado ÷ valorGlobal × 100, 2 casas HALF_EVEN.
 * - RN_CD_002 — Σ parcelas = valorGlobal EXATO; o resíduo de centavos é absorvido
 *   pela última parcela.
 * - Sub-linha única "Evento Tn Meta 01" = valor cheio da parcela (meta única / CONSOLIDADA).
 * - Coluna 7 do ANEXO 9 ("Valor Acumulado por Ano do TP") só aparece nas linhas de
 *   subtotal anual e vale o próprio desembolso acumulado ao fim do ano.
 */

export type SubLinhaParcela = { rotulo: string; valor: Prisma.Decimal };

export type ParcelaCronograma = {
  numero: number;
  data: Date;
  descricao: string;
  desembolso: Prisma.Decimal;
  desembolsoAcumulado: Prisma.Decimal;
  percentualFinanceiroAcumulado: Prisma.Decimal;
  subLinhas: SubLinhaParcela[];
};

export type SubtotalAnual = {
  ano: number;
  totalDoAno: Prisma.Decimal;
  desembolsoAcumulado: Prisma.Decimal;
  percentualFinanceiroAcumulado: Prisma.Decimal;
  /** ANEXO 9 coluna 7 — igual ao `desembolsoAcumulado` ao fim do ano. */
  valorAcumuladoPorAnoDoTP: Prisma.Decimal;
};

export type CronogramaParcelado = {
  parcelas: ParcelaCronograma[];
  subtotaisAnuais: SubtotalAnual[];
  totalGeral: Prisma.Decimal; // == valorGlobal (RN_CD_002)
  valorGlobal: Prisma.Decimal;
};

function percentualAcumulado(acumulado: Prisma.Decimal, valorGlobal: Prisma.Decimal): Prisma.Decimal {
  if (valorGlobal.isZero()) return new Prisma.Decimal(0);
  return acumulado.dividedBy(valorGlobal).times(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);
}

export function agregarEmParcelas(
  linhasMensais: LinhaCronograma[],
  config: ConfigCalendarioRepasse & { valorGlobal: Prisma.Decimal },
): CronogramaParcelado {
  const { valorGlobal } = config;
  const datas = gerarDatasParcela(config);

  // desembolso mensal indexado por "ano-mês(0-index)"
  const porMes = new Map<string, Prisma.Decimal>();
  for (const linha of linhasMensais) {
    const chave = `${linha.competencia.getUTCFullYear()}-${linha.competencia.getUTCMonth()}`;
    porMes.set(chave, (porMes.get(chave) ?? new Prisma.Decimal(0)).plus(linha.desembolsoMensal));
  }

  const fimMes = new Date(Date.UTC(config.dataFim.getUTCFullYear(), config.dataFim.getUTCMonth(), 1));

  function somarPeriodo(de: Date, ate: Date): Prisma.Decimal {
    let total = new Prisma.Decimal(0);
    let cursor = new Date(de.getTime());
    while (cursor.getTime() <= ate.getTime()) {
      const chave = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`;
      total = total.plus(porMes.get(chave) ?? new Prisma.Decimal(0));
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
    return total;
  }

  // Valores brutos por parcela (período antecipado).
  const brutos: Prisma.Decimal[] = datas.map((parcela, indice) => {
    const proxima = datas[indice + 1];
    const ate = proxima
      ? new Date(Date.UTC(proxima.data.getUTCFullYear(), proxima.data.getUTCMonth() - 1, 1))
      : fimMes;
    return somarPeriodo(parcela.data, ate);
  });

  // RN_CD_002 — a última parcela absorve o resíduo para bater com o Valor Global.
  if (brutos.length > 0) {
    const somaExcetoUltima = brutos.slice(0, -1).reduce((acc, v) => acc.plus(v), new Prisma.Decimal(0));
    brutos[brutos.length - 1] = valorGlobal.minus(somaExcetoUltima);
  }

  let acumulado = new Prisma.Decimal(0);
  const parcelas: ParcelaCronograma[] = datas.map((parcela, indice) => {
    const desembolso = brutos[indice];
    acumulado = acumulado.plus(desembolso);
    return {
      numero: parcela.numero,
      data: parcela.data,
      descricao: parcela.descricao,
      desembolso,
      desembolsoAcumulado: acumulado,
      percentualFinanceiroAcumulado: percentualAcumulado(acumulado, valorGlobal),
      subLinhas: [{ rotulo: `Evento T${parcela.numero} Meta 01`, valor: desembolso }],
    };
  });

  const anos = [...new Set(parcelas.map((p) => p.data.getUTCFullYear()))].sort((a, b) => a - b);
  const subtotaisAnuais: SubtotalAnual[] = anos.map((ano) => {
    const doAno = parcelas.filter((p) => p.data.getUTCFullYear() === ano);
    const totalDoAno = doAno.reduce((acc, p) => acc.plus(p.desembolso), new Prisma.Decimal(0));
    const acumuladoAoFimDoAno = doAno[doAno.length - 1].desembolsoAcumulado;
    return {
      ano,
      totalDoAno,
      desembolsoAcumulado: acumuladoAoFimDoAno,
      percentualFinanceiroAcumulado: percentualAcumulado(acumuladoAoFimDoAno, valorGlobal),
      valorAcumuladoPorAnoDoTP: acumuladoAoFimDoAno,
    };
  });

  return { parcelas, subtotaisAnuais, totalGeral: valorGlobal, valorGlobal };
}
