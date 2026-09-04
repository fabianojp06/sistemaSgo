import { describe, expect, it } from 'vitest';
import { gerarDatasParcela } from './gerarDatasParcela';

const d = (ano: number, mes1: number) => new Date(Date.UTC(ano, mes1 - 1, 1));

describe('gerarDatasParcela [US-142 / ADR-049 §D]', () => {
  it('reproduz a estrutura do ANEXO 9 (início coincide com o 1º repasse → fusão de T1)', () => {
    const parcelas = gerarDatasParcela({
      dataInicio: d(2026, 1),
      dataFim: new Date(Date.UTC(2030, 7, 31)),
      parcelasPorAno: 3,
      mesInicialRepasse: 1, // jan / mai / set
    });

    expect(parcelas).toHaveLength(14);
    expect(parcelas[0].data.getTime()).toBe(d(2026, 1).getTime());
    expect(parcelas[0].descricao).toBe('1ª parcela relativa às Etapas 1 e 2 do Cronograma Físico');
    expect(parcelas[1].descricao).toBe('2ª parcela relativa à Etapa 3 do Cronograma Físico');
    expect(parcelas[2].data.getTime()).toBe(d(2026, 9).getTime());
    expect(parcelas[13].descricao).toBe('14ª parcela relativa à Etapa 15 do Cronograma Físico');
    expect(parcelas[13].data.getTime()).toBe(d(2030, 5).getTime());
  });

  it('início NÃO coincide com o 1º repasse → sem deslocamento de Etapa', () => {
    const parcelas = gerarDatasParcela({
      dataInicio: d(2020, 5),
      dataFim: new Date(Date.UTC(2021, 8, 30)),
      parcelasPorAno: 2,
      mesInicialRepasse: 3, // mar / set
    });

    expect(parcelas.map((p) => [p.data.toISOString().slice(0, 7), p.descricao])).toEqual([
      ['2020-05', '1ª parcela relativa à Etapa 1 do Cronograma Físico'],
      ['2020-09', '2ª parcela relativa à Etapa 2 do Cronograma Físico'],
      ['2021-03', '3ª parcela relativa à Etapa 3 do Cronograma Físico'],
      ['2021-09', '4ª parcela relativa à Etapa 4 do Cronograma Físico'],
    ]);
  });

  it('proposta curta (nenhuma data regular na vigência) → só T1', () => {
    const parcelas = gerarDatasParcela({
      dataInicio: d(2026, 7),
      dataFim: new Date(Date.UTC(2026, 7, 31)),
      parcelasPorAno: 3,
      mesInicialRepasse: 1,
    });
    expect(parcelas).toHaveLength(1);
    expect(parcelas[0].descricao).toBe('1ª parcela relativa à Etapa 1 do Cronograma Físico');
  });

  it('cobre os espaçamentos válidos 1/2/3/4/6/12', () => {
    const base = { dataInicio: d(2026, 1), dataFim: new Date(Date.UTC(2026, 11, 31)), mesInicialRepasse: 1 };
    expect(gerarDatasParcela({ ...base, parcelasPorAno: 1 })).toHaveLength(1); // T1 só (jan é a entrada e a única regular)
    expect(gerarDatasParcela({ ...base, parcelasPorAno: 2 })).toHaveLength(2); // jan, jul
    expect(gerarDatasParcela({ ...base, parcelasPorAno: 4 })).toHaveLength(4); // jan, abr, jul, out
    expect(gerarDatasParcela({ ...base, parcelasPorAno: 6 })).toHaveLength(6);
    expect(gerarDatasParcela({ ...base, parcelasPorAno: 12 })).toHaveLength(12);
  });

  it('rejeita parcelasPorAno fora de {1,2,3,4,6,12} e mês fora de 1..12', () => {
    const base = { dataInicio: d(2026, 1), dataFim: new Date(Date.UTC(2026, 11, 31)) };
    expect(() => gerarDatasParcela({ ...base, parcelasPorAno: 5, mesInicialRepasse: 1 })).toThrow();
    expect(() => gerarDatasParcela({ ...base, parcelasPorAno: 3, mesInicialRepasse: 0 })).toThrow();
    expect(() => gerarDatasParcela({ ...base, parcelasPorAno: 3, mesInicialRepasse: 13 })).toThrow();
  });
});
