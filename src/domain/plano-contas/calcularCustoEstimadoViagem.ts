import { Prisma } from '@prisma/client';

type CustosViagem = {
  quantidadePessoas: number;
  mediaDias: number;
  custoUnitarioPassagem: Prisma.Decimal.Value;
  custoUnitarioDiaria: Prisma.Decimal.Value;
  custoUnitarioTransporte: Prisma.Decimal.Value;
};

/**
 * US-109 [ORIGEM BLINDADA] — Custo Estimado da Viagem = (Qtd Pessoas × Passagem)
 * + (Qtd Pessoas × Média de Dias × Diária) + (Qtd Pessoas × Transporte). Sempre
 * calculado pelo backend, nunca aceito como input direto.
 */
export function calcularCustoEstimadoViagem(custos: CustosViagem): Prisma.Decimal {
  const qtd = new Prisma.Decimal(custos.quantidadePessoas);
  const dias = new Prisma.Decimal(custos.mediaDias);

  const passagem = qtd.times(custos.custoUnitarioPassagem);
  const diaria = qtd.times(dias).times(custos.custoUnitarioDiaria);
  const transporte = qtd.times(custos.custoUnitarioTransporte);

  return passagem.plus(diaria).plus(transporte);
}
