import { Prisma } from '@prisma/client';
import type { FaixaPlanoSaude } from '@prisma/client';

type BeneficiosCargo = {
  encargosSociaisPct: Prisma.Decimal.Value;
  vaAtivo: boolean;
  vaValorUnitario: Prisma.Decimal.Value;
  vrAtivo: boolean;
  vrValorUnitario: Prisma.Decimal.Value;
  planoSaudeAtivo: boolean;
  planoSaudeFaixa: FaixaPlanoSaude | null;
  planoSaudeValor: Prisma.Decimal.Value;
  planoOdontoAtivo: boolean;
  planoOdontoValor: Prisma.Decimal.Value;
  seguroVidaAtivo: boolean;
  seguroVidaValor: Prisma.Decimal.Value;
  auxilioCrecheAtivo: boolean;
  auxilioCrecheValor: Prisma.Decimal.Value;
  transporteAtivo: boolean;
  transporteValorUnitario: Prisma.Decimal.Value;
};

/** US-107a — Encargos Sociais = salarioTotal × percentual configurado no Cargo. */
export function calcularEncargosSociais(salarioTotal: Prisma.Decimal.Value, encargosSociaisPct: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(salarioTotal).times(encargosSociaisPct).dividedBy(100);
}

/**
 * US-107a, Cenário 1/2 — soma dos benefícios ativos. VA/VR multiplicam pelo
 * diasUteisPadrao do tenant; os demais são valor fixo mensal. Benefício
 * inativo nunca entra na soma, mesmo com valor preenchido.
 */
export function calcularTotalBeneficios(cargo: BeneficiosCargo, diasUteisPadrao: number): Prisma.Decimal {
  let total = new Prisma.Decimal(0);
  if (cargo.vaAtivo) total = total.plus(new Prisma.Decimal(cargo.vaValorUnitario).times(diasUteisPadrao));
  if (cargo.vrAtivo) total = total.plus(new Prisma.Decimal(cargo.vrValorUnitario).times(diasUteisPadrao));
  if (cargo.planoSaudeAtivo) total = total.plus(cargo.planoSaudeValor);
  if (cargo.planoOdontoAtivo) total = total.plus(cargo.planoOdontoValor);
  if (cargo.seguroVidaAtivo) total = total.plus(cargo.seguroVidaValor);
  if (cargo.auxilioCrecheAtivo) total = total.plus(cargo.auxilioCrecheValor);
  if (cargo.transporteAtivo) total = total.plus(new Prisma.Decimal(cargo.transporteValorUnitario).times(diasUteisPadrao));
  return total;
}

/** US-107a — custoTotalCargo = salarioTotal + Encargos Sociais + Total de Benefícios [ORIGEM BLINDADA]. */
export function calcularCustoTotalCargo(
  salarioTotal: Prisma.Decimal.Value,
  cargo: BeneficiosCargo,
  diasUteisPadrao: number,
): Prisma.Decimal {
  const encargos = calcularEncargosSociais(salarioTotal, cargo.encargosSociaisPct);
  const beneficios = calcularTotalBeneficios(cargo, diasUteisPadrao);
  return new Prisma.Decimal(salarioTotal).plus(encargos).plus(beneficios);
}
