import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { agregarEmParcelas } from './agregarEmParcelas';
import type { LinhaCronograma } from './montarCronogramaDesembolso';

const d = (ano: number, mes1: number) => new Date(Date.UTC(ano, mes1 - 1, 1));

/** Gera N linhas mensais [dataInicio..dataFim] com `valorMes` em cada uma. */
function linhasUniformes(dataInicio: Date, dataFim: Date, valorMes: number): LinhaCronograma[] {
  const linhas: LinhaCronograma[] = [];
  let cursor = d(dataInicio.getUTCFullYear(), dataInicio.getUTCMonth() + 1);
  const limite = d(dataFim.getUTCFullYear(), dataFim.getUTCMonth() + 1);
  let acumulado = new Prisma.Decimal(0);
  let mes = 1;
  while (cursor.getTime() <= limite.getTime()) {
    const desembolsoMensal = new Prisma.Decimal(valorMes);
    acumulado = acumulado.plus(desembolsoMensal);
    linhas.push({
      mes,
      competencia: cursor,
      desembolsoMensal,
      desembolsoAcumulado: acumulado,
      percentualFinanceiroAcumulado: new Prisma.Decimal(0),
      valorRepassado12Meses: null,
    });
    cursor = d(cursor.getUTCFullYear(), cursor.getUTCMonth() + 2);
    mes += 1;
  }
  return linhas;
}

describe('agregarEmParcelas [US-142 / ADR-049 §B]', () => {
  const dataInicio = d(2026, 1);
  const dataFim = new Date(Date.UTC(2030, 7, 31)); // 55 meses
  const linhas = linhasUniformes(dataInicio, dataFim, 1000);
  const valorGlobal = linhas[linhas.length - 1].desembolsoAcumulado; // 55.000

  it('produz 14 parcelas com a estrutura do ANEXO 9', () => {
    const c = agregarEmParcelas(linhas, {
      dataInicio,
      dataFim,
      parcelasPorAno: 3,
      mesInicialRepasse: 1,
      valorGlobal,
    });
    expect(c.parcelas).toHaveLength(14);
    expect(c.parcelas[0].descricao).toContain('Etapas 1 e 2');
    expect(c.parcelas[13].descricao).toContain('Etapa 15');
    expect(c.parcelas[0].subLinhas).toEqual([
      { rotulo: 'Evento T1 Meta 01', valor: c.parcelas[0].desembolso },
    ]);
  });

  it('RN_CD_002 — a soma das parcelas é EXATAMENTE o Valor Global', () => {
    const c = agregarEmParcelas(linhas, { dataInicio, dataFim, parcelasPorAno: 3, mesInicialRepasse: 1, valorGlobal });
    const soma = c.parcelas.reduce((a, p) => a.plus(p.desembolso), new Prisma.Decimal(0));
    expect(soma.equals(valorGlobal)).toBe(true);
    expect(c.totalGeral.equals(valorGlobal)).toBe(true);
    expect(c.parcelas[13].desembolsoAcumulado.equals(valorGlobal)).toBe(true);
  });

  it('resíduo de arredondamento vai para a última parcela', () => {
    // Valor Global "quebrado" que não fecha com a soma bruta dos meses.
    const c = agregarEmParcelas(linhas, {
      dataInicio,
      dataFim,
      parcelasPorAno: 3,
      mesInicialRepasse: 1,
      valorGlobal: new Prisma.Decimal('55000.07'),
    });
    const soma = c.parcelas.reduce((a, p) => a.plus(p.desembolso), new Prisma.Decimal(0));
    expect(soma.toFixed(2)).toBe('55000.07');
  });

  it('% Financeiro Acumulado — 2 casas, última parcela = 100,00', () => {
    const c = agregarEmParcelas(linhas, { dataInicio, dataFim, parcelasPorAno: 3, mesInicialRepasse: 1, valorGlobal });
    expect(c.parcelas[13].percentualFinanceiroAcumulado.toFixed(2)).toBe('100.00');
    for (const p of c.parcelas) {
      expect(p.percentualFinanceiroAcumulado.decimalPlaces()).toBeLessThanOrEqual(2);
    }
  });

  it('subtotais anuais — um por ano civil, com coluna 7 = acumulado do ano', () => {
    const c = agregarEmParcelas(linhas, { dataInicio, dataFim, parcelasPorAno: 3, mesInicialRepasse: 1, valorGlobal });
    expect(c.subtotaisAnuais.map((s) => s.ano)).toEqual([2026, 2027, 2028, 2029, 2030]);
    for (const s of c.subtotaisAnuais) {
      expect(s.valorAcumuladoPorAnoDoTP.equals(s.desembolsoAcumulado)).toBe(true);
    }
    // acumulado do último ano == Valor Global
    expect(c.subtotaisAnuais[4].desembolsoAcumulado.equals(valorGlobal)).toBe(true);
  });

  it('período ANTECIPADO — T1 cobre do início até o mês anterior a T2', () => {
    const c = agregarEmParcelas(linhas, { dataInicio, dataFim, parcelasPorAno: 3, mesInicialRepasse: 1, valorGlobal });
    // T1 (jan) cobre jan..abr = 4 meses × 1000 = 4000
    expect(c.parcelas[0].desembolso.equals(new Prisma.Decimal(4000))).toBe(true);
    // T2 (mai) cobre mai..ago = 4 meses = 4000
    expect(c.parcelas[1].desembolso.equals(new Prisma.Decimal(4000))).toBe(true);
  });
});
