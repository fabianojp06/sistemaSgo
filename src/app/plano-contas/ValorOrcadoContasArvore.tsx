'use client';

import { useState } from 'react';

type NoResumo = { id: string; label: string; total: string; isAnalitica: boolean; filhas: NoResumo[] };

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: string): string {
  return formatadorMoeda.format(Number(valor));
}

/** US-118 — árvore expansível de contas sintéticas com total agregado, mesmo padrão de EmpregadosPorCargoArvore. */
export function ValorOrcadoContasArvore({ sinteticas }: { sinteticas: NoResumo[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
      <div className="border-b bg-slate-50 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-slate-800">Contas Sintéticas — Valor Orçado</h3>
      </div>
      {sinteticas.map((no) => (
        <NoArvore key={no.id} no={no} profundidade={0} />
      ))}
    </div>
  );
}

function NoArvore({ no, profundidade }: { no: NoResumo; profundidade: number }) {
  const [aberto, setAberto] = useState(false);
  const temFilhas = no.filhas.length > 0;

  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        onClick={() => temFilhas && setAberto((atual) => !atual)}
        disabled={!temFilhas}
        style={{ paddingLeft: `${1 + profundidade * 1.5}rem` }}
        className="flex w-full items-center justify-between py-2.5 pr-4 text-left text-sm hover:bg-slate-100 disabled:cursor-default"
      >
        <span className={no.isAnalitica ? 'text-slate-600' : 'font-medium text-slate-800'}>
          {temFilhas && <span className="mr-1.5 inline-block text-slate-400">{aberto ? '▾' : '▸'}</span>}
          {no.label}
        </span>
        <span className="tabular-nums text-xs text-gray-500">{formatarMoeda(no.total)}</span>
      </button>
      {aberto && temFilhas && (
        <div className="bg-slate-50/60">
          {no.filhas.map((filha) => (
            <NoArvore key={filha.id} no={filha} profundidade={profundidade + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
