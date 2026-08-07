import { describe, expect, it } from 'vitest';
import { calcularComponentesCustoViagem, calcularCustoEstimadoViagem } from './calcularCustoEstimadoViagem';

describe('calcularCustoEstimadoViagem / calcularComponentesCustoViagem [US-109, ADR-036]', () => {
  const custos = {
    quantidadePessoas: 3,
    mediaDias: 5,
    custoUnitarioPassagem: 200,
    custoUnitarioDiaria: 100,
    custoUnitarioTransporte: 50,
  };

  it('calcula cada componente separadamente (Qtd×Passagem, Qtd×Dias×Diária, Qtd×Transporte)', () => {
    const componentes = calcularComponentesCustoViagem(custos);

    expect(componentes.passagem.toNumber()).toBe(600); // 3 × 200
    expect(componentes.diaria.toNumber()).toBe(1500); // 3 × 5 × 100
    expect(componentes.transporte.toNumber()).toBe(150); // 3 × 50
  });

  it('custoEstimado é sempre a soma dos 3 componentes — nunca diverge por construção', () => {
    const componentes = calcularComponentesCustoViagem(custos);
    const total = calcularCustoEstimadoViagem(custos);

    const somaComponentes = componentes.passagem.plus(componentes.diaria).plus(componentes.transporte);
    expect(total.toNumber()).toBe(somaComponentes.toNumber());
    expect(total.toNumber()).toBe(2250);
  });

  it('com custos zerados, todos os componentes e o total são zero', () => {
    const componentes = calcularComponentesCustoViagem({
      quantidadePessoas: 1,
      mediaDias: 1,
      custoUnitarioPassagem: 0,
      custoUnitarioDiaria: 0,
      custoUnitarioTransporte: 0,
    });

    expect(componentes.passagem.toNumber()).toBe(0);
    expect(componentes.diaria.toNumber()).toBe(0);
    expect(componentes.transporte.toNumber()).toBe(0);
  });
});
