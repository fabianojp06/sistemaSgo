import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { montarResumoValorOrcado, extrairRankingPorNivel } from './montarResumoValorOrcado';

describe('montarResumoValorOrcado [US-118]', () => {
  it('só retorna sintéticas com pelo menos uma analítica-filha com valor lançado', () => {
    const contas = [
      { id: 'sint-com-valor', idPai: null, isAnalitica: false, label: 'Despesa com Pessoal', nivel: 1 },
      { id: 'an-1', idPai: 'sint-com-valor', isAnalitica: true, label: 'Salários', nivel: 2 },
      { id: 'sint-sem-valor', idPai: null, isAnalitica: false, label: 'Despesa com Material', nivel: 1 },
      { id: 'an-2', idPai: 'sint-sem-valor', isAnalitica: true, label: 'Material de Escritório', nivel: 2 },
    ];
    const valores = new Map([['an-1', new Prisma.Decimal(1000)]]);

    const resumo = montarResumoValorOrcado(contas, valores);

    expect(resumo).toHaveLength(1);
    expect(resumo[0].id).toBe('sint-com-valor');
    expect(resumo[0].total.toNumber()).toBe(1000);
  });

  it('agrega recursivamente sintética-de-sintética', () => {
    const contas = [
      { id: 'raiz', idPai: null, isAnalitica: false, label: 'Raiz', nivel: 1 },
      { id: 'meio', idPai: 'raiz', isAnalitica: false, label: 'Meio', nivel: 2 },
      { id: 'folha-1', idPai: 'meio', isAnalitica: true, label: 'Folha 1', nivel: 3 },
      { id: 'folha-2', idPai: 'meio', isAnalitica: true, label: 'Folha 2', nivel: 3 },
    ];
    const valores = new Map([
      ['folha-1', new Prisma.Decimal(300)],
      ['folha-2', new Prisma.Decimal(700)],
    ]);

    const resumo = montarResumoValorOrcado(contas, valores);

    expect(resumo[0].total.toNumber()).toBe(1000);
    expect(resumo[0].filhas).toHaveLength(1);
    expect(resumo[0].filhas[0].id).toBe('meio');
    expect(resumo[0].filhas[0].total.toNumber()).toBe(1000);
  });

  it('folha analítica sem valor lançado não aparece entre as filhas', () => {
    const contas = [
      { id: 'sint', idPai: null, isAnalitica: false, label: 'Sintética', nivel: 1 },
      { id: 'an-com-valor', idPai: 'sint', isAnalitica: true, label: 'Com valor', nivel: 2 },
      { id: 'an-sem-valor', idPai: 'sint', isAnalitica: true, label: 'Sem valor', nivel: 2 },
    ];
    const valores = new Map([['an-com-valor', new Prisma.Decimal(500)]]);

    const resumo = montarResumoValorOrcado(contas, valores);

    expect(resumo[0].filhas).toHaveLength(1);
    expect(resumo[0].filhas[0].id).toBe('an-com-valor');
  });

  it('sem nenhum valor lançado, retorna lista vazia', () => {
    const contas = [
      { id: 'sint', idPai: null, isAnalitica: false, label: 'Sintética', nivel: 1 },
      { id: 'an', idPai: 'sint', isAnalitica: true, label: 'Analítica', nivel: 2 },
    ];

    const resumo = montarResumoValorOrcado(contas, new Map());

    expect(resumo).toHaveLength(0);
  });
});

describe('extrairRankingPorNivel [US-121, ADR-035]', () => {
  // Árvore: raiz (nivel 1) -> meio "1.9" (nivel 2) -> folha-1/folha-2 (nivel 3, analíticas)
  const contas = [
    { id: 'raiz', idPai: null, isAnalitica: false, label: 'Raiz', nivel: 1 },
    { id: 'meio', idPai: 'raiz', isAnalitica: false, label: 'Meio', nivel: 2 },
    { id: 'folha-1', idPai: 'meio', isAnalitica: true, label: 'Folha 1', nivel: 3 },
    { id: 'folha-2', idPai: 'meio', isAnalitica: true, label: 'Folha 2', nivel: 3 },
  ];
  const valores = new Map([
    ['folha-1', new Prisma.Decimal(300)],
    ['folha-2', new Prisma.Decimal(700)],
  ]);

  it('nível 1 (padrão) retorna só a raiz, com o total inteiro', () => {
    const resumo = montarResumoValorOrcado(contas, valores);
    const ranking = extrairRankingPorNivel(resumo, 1);

    expect(ranking).toHaveLength(1);
    expect(ranking[0].id).toBe('raiz');
    expect(ranking[0].total.toNumber()).toBe(1000);
  });

  it('nível exato (2) para na conta "meio", sem descer até as folhas', () => {
    const resumo = montarResumoValorOrcado(contas, valores);
    const ranking = extrairRankingPorNivel(resumo, 2);

    expect(ranking).toHaveLength(1);
    expect(ranking[0].id).toBe('meio');
    expect(ranking[0].total.toNumber()).toBe(1000);
  });

  it('ramo mais raso que o nível pedido: nível 4 usa as folhas analíticas de nível 3, sem perder valor', () => {
    const resumo = montarResumoValorOrcado(contas, valores);
    const ranking = extrairRankingPorNivel(resumo, 4);

    expect(ranking).toHaveLength(2);
    expect(ranking.map((b) => b.id).sort()).toEqual(['folha-1', 'folha-2']);
    const somaTotal = ranking.reduce((acc, b) => acc.plus(b.total), new Prisma.Decimal(0));
    expect(somaTotal.toNumber()).toBe(1000);
  });

  it('conta já analítica antes do nível pedido também para (não force descer além do que existe)', () => {
    const contasComAnaliticaRasa = [
      { id: 'raiz2', idPai: null, isAnalitica: false, label: 'Raiz2', nivel: 1 },
      { id: 'an-rasa', idPai: 'raiz2', isAnalitica: true, label: 'Analítica Rasa', nivel: 2 },
    ];
    const valoresRasos = new Map([['an-rasa', new Prisma.Decimal(50)]]);
    const resumo = montarResumoValorOrcado(contasComAnaliticaRasa, valoresRasos);

    const ranking = extrairRankingPorNivel(resumo, 4);

    expect(ranking).toHaveLength(1);
    expect(ranking[0].id).toBe('an-rasa');
    expect(ranking[0].total.toNumber()).toBe(50);
  });
});
