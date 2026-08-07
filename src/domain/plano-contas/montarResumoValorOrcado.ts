import { Prisma } from '@prisma/client';

type ContaHierarquia = { id: string; idPai: string | null; isAnalitica: boolean; label: string };

export type NoResumoValorOrcado = {
  id: string;
  label: string;
  total: Prisma.Decimal;
  isAnalitica: boolean;
  filhas: NoResumoValorOrcado[];
};

/**
 * US-118 — resumo do Valor Orçado por conta, para a guia Valor Orçado (dashboard).
 * Diferente de ValorOrcadoTotalizerService (que soma por exercício específico,
 * usado ao recalcular ancestrais após um lançamento), aqui soma TODOS os
 * exercícios já lançados na Versão de uma vez — mesmo escopo do "Valor
 * Global" (soma bruta de ValorOrcadoConta, sem filtrar exercício).
 *
 * Retorna só as contas SINTÉTICAS com total > 0 (pelo menos uma
 * analítica-descendente com valor lançado), cada uma com suas filhas diretas
 * (analíticas ou sintéticas) também já totalizadas — a UI expande 1 nível por
 * vez, sem precisar recalcular ao expandir.
 */
export function montarResumoValorOrcado(
  contas: ContaHierarquia[],
  valoresPorContaAnalitica: Map<string, Prisma.Decimal>,
): NoResumoValorOrcado[] {
  const porId = new Map(contas.map((c) => [c.id, c]));
  const filhasPorPai = new Map<string, ContaHierarquia[]>();
  for (const conta of contas) {
    if (conta.idPai === null) continue;
    const lista = filhasPorPai.get(conta.idPai) ?? [];
    lista.push(conta);
    filhasPorPai.set(conta.idPai, lista);
  }

  function montarNo(contaId: string): NoResumoValorOrcado | null {
    const conta = porId.get(contaId);
    if (!conta) return null;

    if (conta.isAnalitica) {
      const total = valoresPorContaAnalitica.get(contaId) ?? new Prisma.Decimal(0);
      return { id: conta.id, label: conta.label, total, isAnalitica: true, filhas: [] };
    }

    const filhas = (filhasPorPai.get(contaId) ?? [])
      .map((f) => montarNo(f.id))
      .filter((n): n is NoResumoValorOrcado => n !== null && !n.total.isZero());

    const total = filhas.reduce((acc, f) => acc.plus(f.total), new Prisma.Decimal(0));
    return { id: conta.id, label: conta.label, total, isAnalitica: false, filhas };
  }

  const raizes = contas.filter((c) => c.idPai === null);
  return raizes
    .map((r) => montarNo(r.id))
    .filter((n): n is NoResumoValorOrcado => n !== null && !n.isAnalitica && !n.total.isZero());
}
