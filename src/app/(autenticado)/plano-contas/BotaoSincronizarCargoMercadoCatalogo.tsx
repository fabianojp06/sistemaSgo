'use client';

import { useState, useTransition } from 'react';
import { sincronizarCargoMercadoCatalogo } from './actions';

/** ADR-047 (US-139) — dispara a sincronização do Catálogo de Cargo de Mercado. */
export function BotaoSincronizarCargoMercadoCatalogo() {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleClick() {
    setErro(null);
    startTransition(async () => {
      const resultado = await sincronizarCargoMercadoCatalogo();
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
        {pending ? 'Sincronizando…' : 'Sincronizar Catálogo de Cargo de Mercado'}
      </button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
