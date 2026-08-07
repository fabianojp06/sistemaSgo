import { Prisma } from '@prisma/client';

type CustosViagem = {
  quantidadePessoas: number;
  mediaDias: number;
  custoUnitarioPassagem: Prisma.Decimal.Value;
  custoUnitarioDiaria: Prisma.Decimal.Value;
  custoUnitarioTransporte: Prisma.Decimal.Value;
};

export type ComponentesCustoViagem = {
  passagem: Prisma.Decimal;
  diaria: Prisma.Decimal;
  transporte: Prisma.Decimal;
};

/**
 * US-109 [ORIGEM BLINDADA] — decompõe o custo da Viagem nos 3 componentes:
 * Passagem (Qtd Pessoas × unitário), Diária (Qtd Pessoas × Média de Dias ×
 * unitário) e Transporte (Qtd Pessoas × unitário). Única fonte de verdade da
 * matemática — `calcularCustoEstimadoViagem` soma estes 3 valores, e o
 * dashboard de insights (ADR-036) usa esta função para a composição por
 * componente, sem duplicar a fórmula em nenhum lugar.
 */
export function calcularComponentesCustoViagem(custos: CustosViagem): ComponentesCustoViagem {
  const qtd = new Prisma.Decimal(custos.quantidadePessoas);
  const dias = new Prisma.Decimal(custos.mediaDias);

  return {
    passagem: qtd.times(custos.custoUnitarioPassagem),
    diaria: qtd.times(dias).times(custos.custoUnitarioDiaria),
    transporte: qtd.times(custos.custoUnitarioTransporte),
  };
}

/**
 * US-109 [ORIGEM BLINDADA] — Custo Estimado da Viagem = soma dos 3 componentes
 * de `calcularComponentesCustoViagem`. Sempre calculado pelo backend, nunca
 * aceito como input direto.
 */
export function calcularCustoEstimadoViagem(custos: CustosViagem): Prisma.Decimal {
  const { passagem, diaria, transporte } = calcularComponentesCustoViagem(custos);
  return passagem.plus(diaria).plus(transporte);
}
