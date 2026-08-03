import { Prisma } from '@prisma/client';
import type { FonteAtivaSalario } from '@prisma/client';

type FontesSalariais = {
  fonteAtiva: FonteAtivaSalario;
  salarioMercadoMinimo: Prisma.Decimal.Value;
  salarioMercadoMaximo: Prisma.Decimal.Value;
  salarioReal: Prisma.Decimal.Value | null;
  funcaoGratificada: Prisma.Decimal.Value | null;
};

/**
 * US-107, Cenário 5 [ORIGEM BLINDADA] — Salário Total = valor da Fonte Ativa
 * selecionada + Função Gratificada (se preenchida). Sempre calculado pelo
 * backend, nunca aceito como input direto.
 */
export function calcularSalarioTotalCargo(fontes: FontesSalariais): Prisma.Decimal {
  const valorFonte = obterValorFonteAtiva(fontes);
  const gratificacao = fontes.funcaoGratificada ? new Prisma.Decimal(fontes.funcaoGratificada) : new Prisma.Decimal(0);
  return valorFonte.plus(gratificacao);
}

function obterValorFonteAtiva(fontes: FontesSalariais): Prisma.Decimal {
  switch (fontes.fonteAtiva) {
    case 'MERCADO_MINIMO':
      return new Prisma.Decimal(fontes.salarioMercadoMinimo);
    case 'MERCADO_MAXIMO':
      return new Prisma.Decimal(fontes.salarioMercadoMaximo);
    case 'RUBI':
      return fontes.salarioReal ? new Prisma.Decimal(fontes.salarioReal) : new Prisma.Decimal(0);
  }
}

/**
 * US-107, Cenário 7, REQ_CAR_005 — indicador informativo (não bloqueia
 * salvamento) de que o Salário Real está fora da faixa de mercado.
 */
export function alertaDesvioMercado(
  salarioReal: Prisma.Decimal.Value | null,
  salarioMercadoMinimo: Prisma.Decimal.Value,
  salarioMercadoMaximo: Prisma.Decimal.Value,
): boolean {
  if (salarioReal === null) return false;
  const real = new Prisma.Decimal(salarioReal);
  return real.lessThan(salarioMercadoMinimo) || real.greaterThan(salarioMercadoMaximo);
}
