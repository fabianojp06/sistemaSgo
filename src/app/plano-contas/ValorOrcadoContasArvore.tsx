'use client';

import { useState } from 'react';
import { BarChartHorizontal } from '../propostas/BarChartHorizontal';

type NoResumo = { id: string; label: string; total: string; isAnalitica: boolean; filhas: NoResumo[] };
type BarraRanking = { id: string; label: string; valor: number; cor: string };

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: string | number): string {
  return formatadorMoeda.format(Number(valor));
}

/**
 * US-118 — ranking + árvore, num só Client Component: o gráfico
 * (BarChartHorizontal) exige uma função formatarValor, que não pode
 * atravessar a fronteira Server→Client (só dados serializáveis passam) —
 * por isso `ranking` (dados puros) vem do Server Component pai, mas a
 * função de formatação é definida aqui dentro, já em contexto client.
 */
export function ValorOrcadoResumoVisual({ sinteticas, ranking }: { sinteticas: NoResumo[]; ranking: BarraRanking[] }) {
  return (
    <>
      <BarChartHorizontal titulo="Ranking de Contas Sintéticas — Custo Total" barras={ranking} formatarValor={formatarMoeda} />
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
