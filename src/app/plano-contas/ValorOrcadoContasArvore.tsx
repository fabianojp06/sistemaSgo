'use client';

import { useMemo, useState } from 'react';
import { BarChartHorizontal } from '../propostas/BarChartHorizontal';

type NoResumo = { id: string; label: string; total: string; isAnalitica: boolean; nivel: number; filhas: NoResumo[] };
type BarraRanking = { id: string; label: string; valor: number; cor: string };

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: string | number): string {
  return formatadorMoeda.format(Number(valor));
}

// Paleta categórica validada pela skill dataviz — mesma já usada em EmpregadoPanel.tsx/BadgeSemaforoPanel.tsx.
const PALETA_CATEGORICA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

/** US-121/ADR-035 — hash determinístico simples: mesma conta sempre cai na mesma
 * cor, independente de posição no ranking ou de troca de nível. Não é hash
 * criptográfico — só precisa de estabilidade visual, não distribuição perfeita. */
function corPorConta(contaId: string): string {
  let soma = 0;
  for (let i = 0; i < contaId.length; i++) soma += contaId.charCodeAt(i);
  return PALETA_CATEGORICA[soma % PALETA_CATEGORICA.length];
}

/** US-121/ADR-035 — mesma regra de "conta de parada" de extrairRankingPorNivel no
 * domínio (server), reimplementada aqui em cima da árvore já serializada (string em
 * vez de Prisma.Decimal) para recalcular o ranking no client sem nova query. */
function extrairRankingPorNivel(raizes: NoResumo[], nivelAlvo: number): BarraRanking[] {
  const barras: BarraRanking[] = [];

  function percorrer(no: NoResumo) {
    if (no.isAnalitica || no.nivel >= nivelAlvo) {
      barras.push({ id: no.id, label: no.label, valor: Number(no.total), cor: corPorConta(no.id) });
      return;
    }
    for (const filha of no.filhas) percorrer(filha);
  }

  for (const raiz of raizes) percorrer(raiz);
  return barras;
}

const NIVEIS_DISPONIVEIS = [1, 2, 3, 4] as const;

/**
 * US-118/US-121 — ranking + árvore, num só Client Component: o gráfico
 * (BarChartHorizontal) exige uma função formatarValor, que não pode
 * atravessar a fronteira Server→Client (só dados serializáveis passam) —
 * por isso a árvore completa (dados puros) vem do Server Component pai, e
 * tanto a formatação quanto o recorte do ranking por nível acontecem aqui,
 * já em contexto client (troca de nível é instantânea, sem nova query).
 */
export function ValorOrcadoResumoVisual({ sinteticas }: { sinteticas: NoResumo[] }) {
  const [nivel, setNivel] = useState(1);
  const ranking = useMemo(() => extrairRankingPorNivel(sinteticas, nivel), [sinteticas, nivel]);

  return (
    <>
      <div className="flex items-center justify-end gap-1 px-1 text-xs">
        <span className="text-slate-500">Nível:</span>
        {NIVEIS_DISPONIVEIS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNivel(n)}
            className={`rounded px-2 py-1 font-medium ${
              nivel === n ? 'bg-blue-600 text-white' : 'border border-gray-200 text-slate-600 hover:border-blue-300'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <BarChartHorizontal titulo="Ranking de Contas — Custo Total" barras={ranking} formatarValor={formatarMoeda} />
      <ValorOrcadoContasArvore sinteticas={sinteticas} />
    </>
  );
}

/** US-118 — árvore expansível de contas sintéticas com total agregado, mesmo padrão de EmpregadosPorCargoArvore. */
export function ValorOrcadoContasArvore({ sinteticas }: { sinteticas: NoResumo[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
      <div className="border-b bg-slate-50 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-slate-800">Contas Sintéticas — Custo Total</h3>
      </div>
      {sinteticas.map((no) => (
        <NoArvore key={no.id} no={no} profundidade={0} maiorValor={Number(no.total)} />
      ))}
    </div>
  );
}

function NoArvore({ no, profundidade, maiorValor }: { no: NoResumo; profundidade: number; maiorValor: number }) {
  const [aberto, setAberto] = useState(false);
  const temFilhas = no.filhas.length > 0;
  // Peso relativo dentro da conta sintética raiz (nível 0) — indica proporção visualmente, sem duplicar o cálculo.
  const percentual = maiorValor > 0 ? Math.min((Number(no.total) / maiorValor) * 100, 100) : 0;

  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        onClick={() => temFilhas && setAberto((atual) => !atual)}
        disabled={!temFilhas}
        className="relative flex w-full items-center justify-between overflow-hidden py-2.5 pr-4 text-left text-sm hover:bg-slate-100 disabled:cursor-default"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-blue-50"
          style={{ width: `${percentual}%` }}
        />
        <span className="relative z-10 flex items-center gap-1.5" style={{ paddingLeft: `${1 + profundidade * 1.5}rem` }}>
          <span className={no.isAnalitica ? 'text-slate-600' : 'font-medium text-slate-800'}>
            {temFilhas && <span className="mr-1.5 inline-block text-slate-400">{aberto ? '▾' : '▸'}</span>}
            {no.label}
          </span>
        </span>
        <span className="relative z-10 tabular-nums text-xs text-gray-500">{formatarMoeda(no.total)}</span>
      </button>
      {aberto && temFilhas && (
        <div className="bg-slate-50/60">
          {no.filhas.map((filha) => (
            <NoArvore key={filha.id} no={filha} profundidade={profundidade + 1} maiorValor={maiorValor} />
          ))}
        </div>
      )}
    </div>
  );
}
