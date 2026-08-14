import { Prisma } from '@prisma/client';
import type { FaixaPlanoSaude, TipoValorAdicional } from '@prisma/client';

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
  // ADR-044 — Periculosidade e Insalubridade: adicionais somados a
  // custoTotalCargo DEPOIS de Encargos Sociais, nunca compondo a base de
  // encargosSociaisPct.
  periculosidadeAtivo: boolean;
  periculosidadeTipo: TipoValorAdicional | null;
  periculosidadeValor: Prisma.Decimal.Value;
  insalubridadeAtivo: boolean;
  insalubridadeTipo: TipoValorAdicional | null;
  insalubridadeValor: Prisma.Decimal.Value;
};

/**
 * ADR-044 — valor mensal de um adicional (Periculosidade/Insalubridade):
 * 0 se inativo (mesmo com valor preenchido de configuração anterior),
 * percentual sobre salarioTotal quando tipo=PERCENTUAL, ou o valor direto
 * quando tipo=VALOR_FIXO.
 */
export function calcularValorAdicional(
  ativo: boolean,
  tipo: TipoValorAdicional | null,
  valor: Prisma.Decimal.Value,
  salarioTotal: Prisma.Decimal.Value,
): Prisma.Decimal {
  if (!ativo) return new Prisma.Decimal(0);
  return tipo === 'PERCENTUAL' ? new Prisma.Decimal(salarioTotal).times(valor).dividedBy(100) : new Prisma.Decimal(valor);
}

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

/**
 * US-107a / ADR-044 — custoTotalCargo = salarioTotal + Encargos Sociais +
 * Periculosidade + Insalubridade + Total de Benefícios [ORIGEM BLINDADA].
 * Periculosidade/Insalubridade são somados depois de Encargos Sociais, sem
 * entrar na base de cálculo dos Encargos (que continua salarioTotal × pct).
 */
export function calcularCustoTotalCargo(
  salarioTotal: Prisma.Decimal.Value,
  cargo: BeneficiosCargo,
  diasUteisPadrao: number,
): Prisma.Decimal {
  const encargos = calcularEncargosSociais(salarioTotal, cargo.encargosSociaisPct);
  const beneficios = calcularTotalBeneficios(cargo, diasUteisPadrao);
  const periculosidade = calcularValorAdicional(cargo.periculosidadeAtivo, cargo.periculosidadeTipo, cargo.periculosidadeValor, salarioTotal);
  const insalubridade = calcularValorAdicional(cargo.insalubridadeAtivo, cargo.insalubridadeTipo, cargo.insalubridadeValor, salarioTotal);
  return new Prisma.Decimal(salarioTotal).plus(encargos).plus(periculosidade).plus(insalubridade).plus(beneficios);
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
  periculosidade: Prisma.Decimal;
  insalubridade: Prisma.Decimal;
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
    periculosidade: calcularValorAdicional(cargo.periculosidadeAtivo, cargo.periculosidadeTipo, cargo.periculosidadeValor, salarioTotal),
    insalubridade: calcularValorAdicional(cargo.insalubridadeAtivo, cargo.insalubridadeTipo, cargo.insalubridadeValor, salarioTotal),
  };
}
