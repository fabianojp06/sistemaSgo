'use client';

import { useState, useTransition } from 'react';
import { atribuirNaturezaConta } from './actions';

export type NoContaContabil = {
  id: string;
  codigoErp: string;
  nomeConta: string;
  idPai: string | null;
  isAnalitica: boolean;
  statusSync: string;
  natureza: 'OPEX' | 'CAPEX' | null;
  filhas: NoContaContabil[];
};

const LABEL_NATUREZA: Record<'OPEX' | 'CAPEX', string> = {
  OPEX: 'OPEX',
  CAPEX: 'CAPEX',
};

function SeletorNatureza({ no }: { no: NoContaContabil }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function alterar(valor: string) {
    setErro(null);
    const natureza = valor === '' ? null : (valor as 'OPEX' | 'CAPEX');
    startTransition(async () => {
      const resultado = await atribuirNaturezaConta(no.id, natureza);
      if (!resultado.sucesso) {
        setErro(resultado.mensagem);
      }
    });
  }

  return (
    <span className="flex items-center gap-1">
      <select
        value={no.natureza ?? ''}
        onChange={(e) => alterar(e.target.value)}
        disabled={pending}
        className="rounded border px-1 py-0.5 text-[11px] disabled:opacity-50"
      >
        <option value="">Sem classificação</option>
        <option value="OPEX">OPEX (Custeio)</option>
        <option value="CAPEX">CAPEX (Investimento)</option>
      </select>
      {erro && <span className="text-[10px] text-red-600">{erro}</span>}
    </span>
  );
}

function No({
  no,
  expandidos,
  onToggle,
  podeClassificarNatureza,
}: {
  no: NoContaContabil;
  expandidos: Set<string>;
  onToggle: (id: string) => void;
  podeClassificarNatureza: boolean;
}) {
  const temFilhas = no.filhas.length > 0;
  const expandido = expandidos.has(no.id);

  return (
    <li>
      <div className="flex items-center gap-2 py-0.5">
        {temFilhas ? (
          <button
            type="button"
            onClick={() => onToggle(no.id)}
            aria-expanded={expandido}
            aria-label={expandido ? `Retrair ${no.nomeConta}` : `Expandir ${no.nomeConta}`}
            className="w-4 shrink-0 text-gray-400 hover:text-gray-700"
          >
            {expandido ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="font-mono text-xs text-gray-500">{no.codigoErp}</span>
        <span className={no.isAnalitica ? 'text-gray-900' : 'font-medium text-gray-700'}>{no.nomeConta}</span>
        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
          {no.statusSync}
        </span>
        {no.natureza && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              no.natureza === 'OPEX' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
            }`}
          >
            {LABEL_NATUREZA[no.natureza]}
          </span>
        )}
        {/* Seletor de natureza só para conta analítica (Cenário 4, US-003) e só com permissão. */}
        {no.isAnalitica && podeClassificarNatureza && <SeletorNatureza no={no} />}
      </div>
      {temFilhas && expandido && (
        <ul className="ml-4 border-l pl-3">
          {no.filhas.map((filha) => (
            <No key={filha.id} no={filha} expandidos={expandidos} onToggle={onToggle} podeClassificarNatureza={podeClassificarNatureza} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** RF_PLA_REQ_004 — árvore multinível, read-only quanto à estrutura ERP (sem
 * botões de escrita em ContaContabil, RF_PLA_REQ_002); o seletor de Natureza
 * (US-003) é parametrização local, não altera dado vindo do ERP. */
export function ArvoreContas({ nos, podeClassificarNatureza }: { nos: NoContaContabil[]; podeClassificarNatureza: boolean }) {
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set(nos.map((no) => no.id)));

  function onToggle(id: string) {
    setExpandidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  }

  return (
    <ul>
      {nos.map((no) => (
        <No key={no.id} no={no} expandidos={expandidos} onToggle={onToggle} podeClassificarNatureza={podeClassificarNatureza} />
      ))}
    </ul>
  );
}
