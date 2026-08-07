import { describe, expect, it } from 'vitest';
import { calcularMesesSobreposicao, contarMesesInclusivo } from './calcularMesesSobreposicao';

describe('contarMesesInclusivo', () => {
  it('contrato de exatamente 1 ano (mesmo dia) conta 12 meses, não 13', () => {
    expect(contarMesesInclusivo(new Date('2026-09-01'), new Date('2027-09-01'))).toBe(12);
  });

  it('mesmo mês (início e fim) conta 1 mês', () => {
    expect(contarMesesInclusivo(new Date('2026-01-05'), new Date('2026-01-20'))).toBe(1);
  });

  it('mesma data em início e fim conta o mínimo de 1 mês', () => {
    expect(contarMesesInclusivo(new Date('2026-01-05'), new Date('2026-01-05'))).toBe(1);
  });

  it('período com fração de dia extra arredonda para cima (US-113b Cenário 2)', () => {
    expect(contarMesesInclusivo(new Date('2026-08-01'), new Date('2026-09-15'))).toBe(2);
  });

  it('mês cheio exato (dia igual) não arredonda para cima', () => {
    expect(contarMesesInclusivo(new Date('2026-03-01'), new Date('2026-04-01'))).toBe(1);
  });
});

describe('calcularMesesSobreposicao', () => {
  it('retorna 0 quando os intervalos não se sobrepõem', () => {
    expect(calcularMesesSobreposicao(new Date('2026-01-01'), new Date('2026-06-30'), new Date('2026-08-01'), new Date('2026-12-31'))).toBe(0);
  });

  it('retorna os meses da interseção quando os intervalos se sobrepõem parcialmente', () => {
    // Interseção: 01/09 a 30/11 = 3 meses
    expect(calcularMesesSobreposicao(new Date('2026-06-01'), new Date('2026-11-30'), new Date('2026-09-01'), new Date('2027-03-01'))).toBe(3);
  });
});
