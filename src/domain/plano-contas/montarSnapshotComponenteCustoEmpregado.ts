import { Prisma } from '@prisma/client';
import { calcularBreakdownComponenteCusto, type BreakdownComponenteCusto } from '@/domain/plano-contas/calcularCustoTotalCargo';

type CargoParaSnapshot = Parameters<typeof calcularBreakdownComponenteCusto>[0] & {
  salarioTotal: Prisma.Decimal.Value;
  custoTotalCargo: Prisma.Decimal.Value;
  contaGratificacaoId: string | null;
  contaEncargosSociaisId: string | null;
  contaValeAlimentacaoId: string | null;
  contaValeRefeicaoId: string | null;
  contaValeTransporteId: string | null;
  contaPlanoOdontologicoId: string | null;
  contaSeguroVidaId: string | null;
  contaPlanoSaudeId: string | null;
  contaAuxilioCrecheId: string | null;
};

export type SnapshotComponenteCustoEmpregado = {
  valorSalarioSnapshot: Prisma.Decimal;
  valorGratificacaoSnapshot: Prisma.Decimal;
  contaGratificacaoId: string | null;
  valorEncargosSociaisSnapshot: Prisma.Decimal;
  contaEncargosSociaisId: string | null;
  valorValeAlimentacaoSnapshot: Prisma.Decimal;
  contaValeAlimentacaoId: string | null;
  valorValeRefeicaoSnapshot: Prisma.Decimal;
  contaValeRefeicaoId: string | null;
  valorValeTransporteSnapshot: Prisma.Decimal;
  contaValeTransporteId: string | null;
  valorPlanoOdontologicoSnapshot: Prisma.Decimal;
  contaPlanoOdontologicoId: string | null;
  valorSeguroVidaSnapshot: Prisma.Decimal;
  contaSeguroVidaId: string | null;
  valorPlanoSaudeSnapshot: Prisma.Decimal;
  contaPlanoSaudeId: string | null;
  valorAuxilioCrecheSnapshot: Prisma.Decimal;
  contaAuxilioCrecheId: string | null;
};

/**
 * ADR-029 — monta o snapshot de valor + conta de cada componente de custo do
 * Cargo para gravar em EmpregadoHeadcount no momento do cadastro/edição
 * (mesmo congelamento de custoTotalMensal/contaId/vinculoFuncionalHerdado).
 * valorSalarioSnapshot é residual (custoTotalCargo menos a soma dos outros 8)
 * — garante que a soma de todos os componentes bate exatamente com
 * custoTotalCargo, nunca sobra nem falta, independente de quais benefícios
 * estavam ativos no momento do snapshot.
 */
export function montarSnapshotComponenteCustoEmpregado(
  cargo: CargoParaSnapshot,
  diasUteisPadrao: number,
): SnapshotComponenteCustoEmpregado {
  const breakdown: BreakdownComponenteCusto = calcularBreakdownComponenteCusto(cargo, cargo.salarioTotal, diasUteisPadrao);

  const somaOutros = breakdown.gratificacao
    .plus(breakdown.encargosSociais)
    .plus(breakdown.valeAlimentacao)
    .plus(breakdown.valeRefeicao)
    .plus(breakdown.valeTransporte)
    .plus(breakdown.planoOdontologico)
    .plus(breakdown.seguroVida)
    .plus(breakdown.planoSaude)
    .plus(breakdown.auxilioCreche);

  return {
    valorSalarioSnapshot: new Prisma.Decimal(cargo.custoTotalCargo).minus(somaOutros),
    valorGratificacaoSnapshot: breakdown.gratificacao,
    contaGratificacaoId: cargo.contaGratificacaoId,
    valorEncargosSociaisSnapshot: breakdown.encargosSociais,
    contaEncargosSociaisId: cargo.contaEncargosSociaisId,
    valorValeAlimentacaoSnapshot: breakdown.valeAlimentacao,
    contaValeAlimentacaoId: cargo.contaValeAlimentacaoId,
    valorValeRefeicaoSnapshot: breakdown.valeRefeicao,
    contaValeRefeicaoId: cargo.contaValeRefeicaoId,
    valorValeTransporteSnapshot: breakdown.valeTransporte,
    contaValeTransporteId: cargo.contaValeTransporteId,
    valorPlanoOdontologicoSnapshot: breakdown.planoOdontologico,
    contaPlanoOdontologicoId: cargo.contaPlanoOdontologicoId,
    valorSeguroVidaSnapshot: breakdown.seguroVida,
    contaSeguroVidaId: cargo.contaSeguroVidaId,
    valorPlanoSaudeSnapshot: breakdown.planoSaude,
    contaPlanoSaudeId: cargo.contaPlanoSaudeId,
    valorAuxilioCrecheSnapshot: breakdown.auxilioCreche,
    contaAuxilioCrecheId: cargo.contaAuxilioCrecheId,
  };
}
