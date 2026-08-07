import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { montarResumoValorOrcado } from './montarResumoValorOrcado';

describe('montarResumoValorOrcado [US-118]', () => {
  it('só retorna sintéticas com pelo menos uma analítica-filha com valor lançado', () => {
    const contas = [
      { id: 'sint-com-valor', idPai: null, isAnalitica: false, label: 'Despesa com Pessoal' },
      { id: 'an-1', idPai: 'sint-com-valor', isAnalitica: true, label: 'Salários' },
      { id: 'sint-sem-valor', idPai: null, isAnalitica: false, label: 'Despesa com Material' },
      { id: 'an-2', idPai: 'sint-sem-valor', isAnalitica: true, label: 'Material de Escritório' },
    ];
    const valores = new Map([['an-1', new Prisma.Decimal(1000)]]);

    const resumo = montarResumoValorOrcado(contas, valores);

    expect(resumo).toHaveLength(1);
    expect(resumo[0].id).toBe('sint-com-valor');
    expect(resumo[0].total.toNumber()).toBe(1000);
  });

  it('agrega recursivamente sintética-de-sintética', () => {
    const contas = [
      { id: 'raiz', idPai: null, isAnalitica: false, label: 'Raiz' },
      { id: 'meio', idPai: 'raiz', isAnalitica: false, label: 'Meio' },
      { id: 'folha-1', idPai: 'meio', isAnalitica: true, label: 'Folha 1' },
      { id: 'folha-2', idPai: 'meio', isAnalitica: true, label: 'Folha 2' },
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
      { id: 'sint', idPai: null, isAnalitica: false, label: 'Sintética' },
      { id: 'an-com-valor', idPai: 'sint', isAnalitica: true, label: 'Com valor' },
      { id: 'an-sem-valor', idPai: 'sint', isAnalitica: true, label: 'Sem valor' },
    ];
    const valores = new Map([['an-com-valor', new Prisma.Decimal(500)]]);

    const resumo = montarResumoValorOrcado(contas, valores);

    expect(resumo[0].filhas).toHaveLength(1);
    expect(resumo[0].filhas[0].id).toBe('an-com-valor');
  });

  it('sem nenhum valor lançado, retorna lista vazia', () => {
    const contas = [
      { id: 'sint', idPai: null, isAnalitica: false, label: 'Sintética' },
      { id: 'an', idPai: 'sint', isAnalitica: true, label: 'Analítica' },
    ];

    const resumo = montarResumoValorOrcado(contas, new Map());

    expect(resumo).toHaveLength(0);
  });
});
