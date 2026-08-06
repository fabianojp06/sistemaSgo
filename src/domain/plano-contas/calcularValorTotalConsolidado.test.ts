import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calcularValorTotalConsolidado } from './calcularValorTotalConsolidado';

describe('calcularValorTotalConsolidado [US-113b]', () => {
  it('soma custoTotalMensal x meses quando o período do Empregado cobre todo o documento', () => {
    const total = calcularValorTotalConsolidado(
      [{ periodoInicio: new Date('2026-01-01'), periodoFim: new Date('2026-12-31'), custoTotalMensal: new Prisma.Decimal(1000) }],
      new Date('2026-03-01'),
      new Date('2026-05-31'),
      new Date('2026-12-31'),
    );

    expect(total.toString()).toBe('3000'); // mar, abr, mai = 3 meses
  });

  it('considera overlap parcial entre período do Empregado e período do documento', () => {
    const total = calcularValorTotalConsolidado(
      [{ periodoInicio: new Date('2026-08-01'), periodoFim: new Date('2026-09-15'), custoTotalMensal: new Prisma.Decimal(2000) }],
      new Date('2026-09-01'),
      new Date('2026-11-30'),
      new Date('2026-12-31'),
    );

    expect(total.toString()).toBe('2000'); // overlap = 01/09 a 15/09 = 1 mês
  });

  it('não contribui quando não há sobreposição de período', () => {
    const total = calcularValorTotalConsolidado(
      [{ periodoInicio: new Date('2027-01-01'), periodoFim: null, custoTotalMensal: new Prisma.Decimal(5000) }],
      new Date('2026-01-01'),
      new Date('2026-12-31'),
      new Date('2027-12-31'),
    );

    expect(total.toString()).toBe('0');
  });

  it('usa dataFimProposta quando periodoFim do Empregado é null', () => {
    const total = calcularValorTotalConsolidado(
      [{ periodoInicio: new Date('2026-11-01'), periodoFim: null, custoTotalMensal: new Prisma.Decimal(1500) }],
      new Date('2026-01-01'),
      new Date('2026-12-31'),
      new Date('2026-12-31'),
    );

    expect(total.toString()).toBe('3000'); // nov, dez = 2 meses
  });

  it('soma a contribuição de múltiplos Empregados com períodos diferentes', () => {
    const total = calcularValorTotalConsolidado(
      [
        { periodoInicio: new Date('2026-01-01'), periodoFim: null, custoTotalMensal: new Prisma.Decimal(6550) },
        { periodoInicio: new Date('2026-08-01'), periodoFim: null, custoTotalMensal: new Prisma.Decimal(5000) },
      ],
      new Date('2026-01-01'),
      new Date('2026-06-30'),
      new Date('2026-12-31'),
    );

    expect(total.toString()).toBe('39300'); // só o primeiro contribui: 6550 * 6 meses
  });
});
