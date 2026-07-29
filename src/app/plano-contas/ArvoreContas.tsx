'use client';

import { useState } from 'react';

export type NoContaContabil = {
  id: string;
  codigoErp: string;
  nomeConta: string;
  idPai: string | null;
  isAnalitica: boolean;
  statusSync: string;
  filhas: NoContaContabil[];
};

function No({
  no,
  expandidos,
  onToggle,
}: {
  no: NoContaContabil;
  expandidos: Set<string>;
  onToggle: (id: string) => void;
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
      </div>
      {temFilhas && expandido && (
        <ul className="ml-4 border-l pl-3">
          {no.filhas.map((filha) => (
            <No key={filha.id} no={filha} expandidos={expandidos} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** RF_PLA_REQ_004 — árvore multinível, read-only (sem botões de escrita, RF_PLA_REQ_002). */
export function ArvoreContas({ nos }: { nos: NoContaContabil[] }) {
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
        <No key={no.id} no={no} expandidos={expandidos} onToggle={onToggle} />
      ))}
    </ul>
  );
}
