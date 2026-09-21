import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { montarAnexo6, type CargoParaAnexo6 } from './montarAnexo6';

const DIAS_UTEIS = 22;

function cargo(overrides: Partial<CargoParaAnexo6> = {}): CargoParaAnexo6 {
  return {
    id: 'cargo-1',
    nomeCargoMercado: 'ADMINISTRADOR',
    quantidadeEmpregados: 2,
    salarioTotal: '6184.57',
    funcaoGratificada: null,
    encargosSociaisPct: '0',
    vaAtivo: false,
    vaValorUnitario: '0',
    vrAtivo: false,
    vrValorUnitario: '0',
    planoSaudeAtivo: false,
    planoSaudeFaixa: null,
    planoSaudeValor: '0',
    planoOdontoAtivo: false,
    planoOdontoValor: '0',
    seguroVidaAtivo: false,
    seguroVidaValor: '0',
    auxilioCrecheAtivo: false,
    auxilioCrecheValor: '0',
    transporteAtivo: false,
    transporteValorUnitario: '0',
    periculosidadeAtivo: false,
    periculosidadeTipo: null,
    periculosidadeValor: '0',
    insalubridadeAtivo: false,
    insalubridadeTipo: null,
    insalubridadeValor: '0',
    ...overrides,
  };
}

function valorDaLinha(anexo: ReturnType<typeof montarAnexo6>, bloco: string, rotulo: string, indiceCargo = 0): string {
  const linha = anexo.blocos.find((b) => b.codigo === bloco)?.linhas.find((l) => l.rotulo === rotulo);
  if (!linha) throw new Error(`Linha não encontrada: ${bloco} / ${rotulo}`);
  return linha.valores[indiceCargo].toFixed(2);
}

/**
 * Os números esperados aqui são os do ANEXO 6 de referência (Termo de Parceria
 * PAME-RJ/CTCEA/2025, Rev.01), coluna ADMINISTRADOR (Salário-Base 6.184,57).
 * Mudar um percentual em `percentuaisAnexo6.ts` quebra este teste de propósito.
 */
describe('montarAnexo6 — conferência contra o anexo de referência (coluna ADMINISTRADOR)', () => {
  const anexo = montarAnexo6([cargo()], DIAS_UTEIS);

  it('Módulo 1 — Salário-Base e Total', () => {
    expect(valorDaLinha(anexo, '1', 'Salário-Base*')).toBe('6184.57');
    expect(valorDaLinha(anexo, '1', 'Total')).toBe('6184.57');
  });

  it('Submódulo 2.1 — 13º (8,33%) e Férias (5,56%)', () => {
    expect(valorDaLinha(anexo, '2.1', '13º (décimo terceiro) Salário')).toBe('515.17');
    expect(valorDaLinha(anexo, '2.1', 'Férias e Adicional de Férias')).toBe('343.86');
    expect(valorDaLinha(anexo, '2.1', 'Total')).toBe('859.03');
  });

  it('Submódulo 2.2 — cada contribuição e o total de 33,50%', () => {
    expect(valorDaLinha(anexo, '2.2', 'INSS')).toBe('1236.91');
    expect(valorDaLinha(anexo, '2.2', 'Salário Educação')).toBe('154.61');
    expect(valorDaLinha(anexo, '2.2', 'SAT- GIL/RAT')).toBe('61.85');
    expect(valorDaLinha(anexo, '2.2', 'SESC ou SESI')).toBe('92.77');
    expect(valorDaLinha(anexo, '2.2', 'SENAI - SENAC')).toBe('0.00');
    expect(valorDaLinha(anexo, '2.2', 'SEBRAE')).toBe('18.55');
    expect(valorDaLinha(anexo, '2.2', 'INCRA')).toBe('12.37');
    expect(valorDaLinha(anexo, '2.2', 'FGTS')).toBe('494.77');
    expect(valorDaLinha(anexo, '2.2', 'Total')).toBe('2071.83');
  });

  it('Módulo 3 — provisão para rescisão de 3%', () => {
    expect(
      valorDaLinha(anexo, '3', 'Multa do FGTS e contribuição social sobre o Aviso Prévio Trabalhado / Provisão Risco Trabalhista'),
    ).toBe('185.54');
    expect(valorDaLinha(anexo, '3', 'Total')).toBe('185.54');
  });

  it('Módulo 6 — PIS de 1% incide sobre o Módulo 1', () => {
    expect(valorDaLinha(anexo, '6', 'Tributos Federais (PIS)')).toBe('61.85');
  });

  it('Módulos 4 e 5 saem zerados, mas com as rubricas impressas', () => {
    expect(anexo.blocos.find((b) => b.codigo === '4.1')?.linhas).toHaveLength(7);
    expect(anexo.blocos.find((b) => b.codigo === '5')?.linhas).toHaveLength(5);
    expect(valorDaLinha(anexo, '4', 'Total')).toBe('0.00');
    expect(valorDaLinha(anexo, '5', 'Total')).toBe('0.00');
  });
});

describe('montarAnexo6 — fechamento aritmético', () => {
  it('ISS de 5% é por dentro: incide sobre o Valor Total por Empregado, não sobre o subtotal', () => {
    const anexo = montarAnexo6([cargo()], DIAS_UTEIS);
    const iss = new Prisma.Decimal(valorDaLinha(anexo, '6', 'Tributos Municipais (ISS)'));
    const valorTotal = new Prisma.Decimal(valorDaLinha(anexo, 'RESUMO', 'Valor Total por Empregado'));

    const aliquotaEfetiva = iss.dividedBy(valorTotal).times(100);
    expect(aliquotaEfetiva.toDecimalPlaces(2).toFixed(2)).toBe('5.00');
  });

  it('Valor Total por Empregado = Subtotal (A..E) + Módulo 6', () => {
    const anexo = montarAnexo6([cargo()], DIAS_UTEIS);
    const subtotal = new Prisma.Decimal(valorDaLinha(anexo, 'RESUMO', 'Subtotal (A + B + C + D + E)'));
    const modulo6 = new Prisma.Decimal(valorDaLinha(anexo, 'RESUMO', 'Módulo 6 – Custos Indiretos, Tributos e Lucro'));
    const total = new Prisma.Decimal(valorDaLinha(anexo, 'RESUMO', 'Valor Total por Empregado'));

    expect(subtotal.plus(modulo6).toFixed(2)).toBe(total.toFixed(2));
  });

  it('Quadro-Resumo do Módulo 2 fecha com a soma dos submódulos 2.1, 2.2 e 2.3', () => {
    const anexo = montarAnexo6([cargo({ vaAtivo: true, vaValorUnitario: '30.00', planoSaudeAtivo: true, planoSaudeValor: '450.00' })], DIAS_UTEIS);
    const sub21 = new Prisma.Decimal(valorDaLinha(anexo, '2.1', 'Total'));
    const sub22 = new Prisma.Decimal(valorDaLinha(anexo, '2.2', 'Total'));
    const sub23 = new Prisma.Decimal(valorDaLinha(anexo, '2.3', 'Total'));
    const modulo2 = new Prisma.Decimal(valorDaLinha(anexo, '2', 'Total'));

    expect(sub21.plus(sub22).plus(sub23).toFixed(2)).toBe(modulo2.toFixed(2));
  });
});

describe('montarAnexo6 — regras de montagem das colunas', () => {
  it('coluna Total é a soma SIMPLES das colunas de Cargo, sem ponderar pelo headcount', () => {
    const anexo = montarAnexo6(
      [
        cargo({ id: 'a', nomeCargoMercado: 'ALMOXARIFE', salarioTotal: '1000.00', quantidadeEmpregados: 11 }),
        cargo({ id: 'b', nomeCargoMercado: 'BIBLIOTECÁRIO', salarioTotal: '2000.00', quantidadeEmpregados: 1 }),
      ],
      DIAS_UTEIS,
    );

    const linhaSalario = anexo.blocos[0].linhas[0];
    expect(linhaSalario.total.toFixed(2)).toBe('3000.00'); // 1000 + 2000, e não 11×1000 + 1×2000
    expect(anexo.quantidadeTotalEmpregados).toBe(12);
  });

  it('Cargo sem empregado vinculado entra como coluna zerada de headcount, com valores calculados', () => {
    const anexo = montarAnexo6([cargo({ quantidadeEmpregados: 0 })], DIAS_UTEIS);

    expect(anexo.colunas[0].quantidadeEmpregados).toBe(0);
    expect(valorDaLinha(anexo, 'RESUMO', 'Valor Total por Empregado')).not.toBe('0.00');
  });

  it('benefícios do Cargo caem nas rubricas do Submódulo 2.3', () => {
    const anexo = montarAnexo6(
      [
        cargo({
          transporteAtivo: true,
          transporteValorUnitario: '8.00', // × 22 dias úteis
          vaAtivo: true,
          vaValorUnitario: '30.00',
          vrAtivo: true,
          vrValorUnitario: '20.00',
          planoSaudeAtivo: true,
          planoSaudeValor: '400.00',
          planoOdontoAtivo: true,
          planoOdontoValor: '50.00',
          seguroVidaAtivo: true,
          seguroVidaValor: '25.00',
          auxilioCrecheAtivo: true,
          auxilioCrecheValor: '300.00',
        }),
      ],
      DIAS_UTEIS,
    );

    expect(valorDaLinha(anexo, '2.3', 'Transporte')).toBe('176.00');
    expect(valorDaLinha(anexo, '2.3', 'Auxílio-Refeição/Alimentação')).toBe('1100.00'); // (30 + 20) × 22
    expect(
      valorDaLinha(anexo, '2.3', 'Assistência médica e familiar (saúde e odontológico) / Seguro de vida, invalidez e funeral'),
    ).toBe('475.00');
    expect(valorDaLinha(anexo, '2.3', 'Outros (Auxílio-Creche)')).toBe('300.00');
  });

  it('adicionais e função gratificada aparecem no Módulo 1, sem entrar na base de encargos (ADR-044)', () => {
    const anexo = montarAnexo6(
      [cargo({ periculosidadeAtivo: true, periculosidadeTipo: 'PERCENTUAL', periculosidadeValor: '30', funcaoGratificada: '500.00' })],
      DIAS_UTEIS,
    );

    expect(valorDaLinha(anexo, '1', 'Adicional de Periculosidade')).toBe('1855.37'); // 30% de 6.184,57
    expect(valorDaLinha(anexo, '1', 'Outros (Função Gratificada)')).toBe('500.00');
    expect(valorDaLinha(anexo, '1', 'Total')).toBe('8539.94');
    // 13º continua 8,33% do Salário-Base, não do Módulo 1 inteiro
    expect(valorDaLinha(anexo, '2.1', '13º (décimo terceiro) Salário')).toBe('515.17');
  });
});
