import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { montarCronogramaDesembolso } from './montarCronogramaDesembolso';

const proposta = { dataInicio: new Date(Date.UTC(2026, 0, 1)), dataFim: new Date(Date.UTC(2026, 11, 31)) };

function empregado(overrides: Partial<Parameters<typeof montarCronogramaDesembolso>[1][number]> = {}) {
  return {
    periodoInicio: new Date(Date.UTC(2026, 0, 1)),
    periodoFim: null,
    valorSalarioSnapshot: new Prisma.Decimal(1000),
    valorGratificacaoSnapshot: new Prisma.Decimal(0),
    valorEncargosSociaisSnapshot: new Prisma.Decimal(0),
    valorValeAlimentacaoSnapshot: new Prisma.Decimal(0),
    valorValeRefeicaoSnapshot: new Prisma.Decimal(0),
    valorValeTransporteSnapshot: new Prisma.Decimal(0),
    valorPlanoOdontologicoSnapshot: new Prisma.Decimal(0),
    valorSeguroVidaSnapshot: new Prisma.Decimal(0),
    valorPlanoSaudeSnapshot: new Prisma.Decimal(0),
    valorAuxilioCrecheSnapshot: new Prisma.Decimal(0),
    ...overrides,
  };
}

describe('montarCronogramaDesembolso [US-122, UC04.01]', () => {
  it('gera 12 linhas para uma vigência de um ano civil', () => {
    const linhas = montarCronogramaDesembolso(proposta, [], [], [], []);
    expect(linhas).toHaveLength(12);
    expect(linhas[0].mes).toBe(1);
    expect(linhas[11].mes).toBe(12);
  });

  it('distribui Empregado mês a mês respeitando sobreposição parcial de período', () => {
    const emp = empregado({
      periodoInicio: new Date(Date.UTC(2026, 2, 1)), // março
      periodoFim: new Date(Date.UTC(2026, 4, 31)), // maio
      valorSalarioSnapshot: new Prisma.Decimal(1000),
    });
    const linhas = montarCronogramaDesembolso(proposta, [emp], [], [], []);

    expect(linhas[0].desembolsoMensal.toNumber()).toBe(0); // janeiro
    expect(linhas[2].desembolsoMensal.toNumber()).toBe(1000); // março
    expect(linhas[3].desembolsoMensal.toNumber()).toBe(1000); // abril
    expect(linhas[4].desembolsoMensal.toNumber()).toBe(1000); // maio
    expect(linhas[5].desembolsoMensal.toNumber()).toBe(0); // junho
  });

  it('atribui ItemPatrimonial ao mês exato do campo data', () => {
    const linhas = montarCronogramaDesembolso(
      proposta,
      [],
      [],
      [{ data: new Date(Date.UTC(2026, 5, 15)), valorTotal: new Prisma.Decimal(500) }],
      [],
    );
    expect(linhas[5].desembolsoMensal.toNumber()).toBe(500); // junho
    expect(linhas[4].desembolsoMensal.toNumber()).toBe(0);
  });

  it('atribui RateioImpostoGrade ao mês exato do campo competencia', () => {
    const linhas = montarCronogramaDesembolso(
      proposta,
      [],
      [],
      [],
      [{ competencia: new Date(Date.UTC(2026, 8, 1)), valorDeclarado: new Prisma.Decimal(300) }],
    );
    expect(linhas[8].desembolsoMensal.toNumber()).toBe(300); // setembro
  });

  it('atribui Viagem inteira ao primeiro mês da vigência (limitação conhecida — sem campo de data)', () => {
    const linhas = montarCronogramaDesembolso(proposta, [], [{ custoEstimado: new Prisma.Decimal(700) }], [], []);
    expect(linhas[0].desembolsoMensal.toNumber()).toBe(700);
    expect(linhas[1].desembolsoMensal.toNumber()).toBe(0);
  });

  it('calcula % financeiro acumulado com 2 casas decimais (RN0252)', () => {
    const emp1 = empregado({ valorSalarioSnapshot: new Prisma.Decimal(1000) });
    const linhas = montarCronogramaDesembolso(proposta, [emp1], [], [], []);
    // 12 meses de 1000 = 12000 total; mês 1 acumulado = 1000 => 1000/12000*100 = 8.3333...
    expect(linhas[0].percentualFinanceiroAcumulado.toNumber()).toBeCloseTo(8.33, 2);
    expect(linhas[11].percentualFinanceiroAcumulado.toNumber()).toBe(100);
  });

  it('preenche Valor Repassado a cada 12 meses só no mês 12 (RN0253)', () => {
    const emp1 = empregado({ valorSalarioSnapshot: new Prisma.Decimal(500) });
    const linhas = montarCronogramaDesembolso(proposta, [emp1], [], [], []);
    for (let i = 0; i < 11; i++) expect(linhas[i].valorRepassado12Meses).toBeNull();
    expect(linhas[11].valorRepassado12Meses).not.toBeNull();
    expect(linhas[11].valorRepassado12Meses?.toNumber()).toBe(6000); // 12 × 500
  });
});
