'use client';

import { useState, useTransition } from 'react';
import { sincronizarGradeSalarialCtcea } from './actions';

/** ADR-046 (US-137) — dispara a sincronização da Grade Salarial CTCEA. */
export function BotaoSincronizarGradeSalarialCtcea() {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleClick() {
    setErro(null);
    startTransition(async () => {
      const resultado = await sincronizarGradeSalarialCtcea();
      if (!resultado.sucesso) {
        setErro(resultado.mensagem);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Sincronizando…' : 'Sincronizar Grade Salarial CTCEA'}
      </button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
