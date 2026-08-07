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

export type BreakdownComponenteCusto = {
  gratificacao: Prisma.Decimal;
  encargosSociais: Prisma.Decimal;
  valeAlimentacao: Prisma.Decimal;
  valeRefeicao: Prisma.Decimal;
  valeTransporte: Prisma.Decimal;
  planoOdontologico: Prisma.Decimal;
  seguroVida: Prisma.Decimal;
  planoSaude: Prisma.Decimal;
  auxilioCreche: Prisma.Decimal;
};

/**
 * ADR-029 — valor mensal de cada componente de custo do Cargo, já com o gate
 * de "ativo" aplicado (benefício inativo = 0, mesmo com valor preenchido) e
 * VA/VR/Transporte já multiplicados por diasUteisPadrao — os mesmos valores
 * que somados dão calcularTotalBeneficios. Usado para o snapshot por conta em
 * EmpregadoHeadcount (cada componente vai para sua própria conta analítica).
 */
export function calcularBreakdownComponenteCusto(
  cargo: BeneficiosCargo & { funcaoGratificada?: Prisma.Decimal.Value | null },
  salarioTotal: Prisma.Decimal.Value,
  diasUteisPadrao: number,
): BreakdownComponenteCusto {
  return {
    gratificacao: new Prisma.Decimal(cargo.funcaoGratificada ?? 0),
    encargosSociais: calcularEncargosSociais(salarioTotal, cargo.encargosSociaisPct),
    valeAlimentacao: cargo.vaAtivo ? new Prisma.Decimal(cargo.vaValorUnitario).times(diasUteisPadrao) : new Prisma.Decimal(0),
    valeRefeicao: cargo.vrAtivo ? new Prisma.Decimal(cargo.vrValorUnitario).times(diasUteisPadrao) : new Prisma.Decimal(0),
    valeTransporte: cargo.transporteAtivo
      ? new Prisma.Decimal(cargo.transporteValorUnitario).times(diasUteisPadrao)
      : new Prisma.Decimal(0),
    planoOdontologico: cargo.planoOdontoAtivo ? new Prisma.Decimal(cargo.planoOdontoValor) : new Prisma.Decimal(0),
    seguroVida: cargo.seguroVidaAtivo ? new Prisma.Decimal(cargo.seguroVidaValor) : new Prisma.Decimal(0),
    planoSaude: cargo.planoSaudeAtivo ? new Prisma.Decimal(cargo.planoSaudeValor) : new Prisma.Decimal(0),
    auxilioCreche: cargo.auxilioCrecheAtivo ? new Prisma.Decimal(cargo.auxilioCrecheValor) : new Prisma.Decimal(0),
  };
}
