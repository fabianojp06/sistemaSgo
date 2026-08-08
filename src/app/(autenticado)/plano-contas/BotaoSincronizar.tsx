'use client';

import { useState, useTransition } from 'react';
import { sincronizarPlanoContas } from './actions';

/** UC03.00 — dispara o Fluxo Principal de sincronismo (RF_PLA_REQ_001). */
export function BotaoSincronizar() {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleClick() {
    setErro(null);
    startTransition(async () => {
      const resultado = await sincronizarPlanoContas();
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
        {pending ? 'Sincronizando…' : 'Sincronizar com ERP Senior'}
      </button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
