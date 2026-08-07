import { Prisma } from '@prisma/client';

type ContaHierarquia = { id: string; idPai: string | null; isAnalitica: boolean; label: string; nivel: number };

export type NoResumoValorOrcado = {
  id: string;
  label: string;
  total: Prisma.Decimal;
  isAnalitica: boolean;
  nivel: number;
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
      return { id: conta.id, label: conta.label, total, isAnalitica: true, nivel: conta.nivel, filhas: [] };
    }

    const filhas = (filhasPorPai.get(contaId) ?? [])
      .map((f) => montarNo(f.id))
      .filter((n): n is NoResumoValorOrcado => n !== null && !n.total.isZero());

    const total = filhas.reduce((acc, f) => acc.plus(f.total), new Prisma.Decimal(0));
    return { id: conta.id, label: conta.label, total, isAnalitica: false, nivel: conta.nivel, filhas };
  }

  const raizes = contas.filter((c) => c.idPai === null);
  return raizes
    .map((r) => montarNo(r.id))
    .filter((n): n is NoResumoValorOrcado => n !== null && !n.isAnalitica && !n.total.isZero());
}

export type BarraRankingNivel = { id: string; label: string; total: Prisma.Decimal };

/**
 * US-121/ADR-035 — extrai as barras do ranking no nível hierárquico `nivelAlvo`
 * (1 = raízes, comportamento anterior a esta US). Para em cada ramo raiz→folha
 * no primeiro nó cujo `nivel >= nivelAlvo` OU que já é `isAnalitica` antes
 * disso — o que vier primeiro. Isso garante que 100% do valor sempre aparece
 * distribuído entre as barras: um ramo mais raso que o nível pedido não
 * "some", reaparece como barra no seu próprio nível mais fundo.
 */
export function extrairRankingPorNivel(raizes: NoResumoValorOrcado[], nivelAlvo: number): BarraRankingNivel[] {
  const barras: BarraRankingNivel[] = [];

  function percorrer(no: NoResumoValorOrcado) {
    if (no.isAnalitica || no.nivel >= nivelAlvo) {
      barras.push({ id: no.id, label: no.label, total: no.total });
      return;
    }
    for (const filha of no.filhas) percorrer(filha);
  }

  for (const raiz of raizes) percorrer(raiz);
  return barras;
}
