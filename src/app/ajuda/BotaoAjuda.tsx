'use client';

import { useState } from 'react';

/**
 * UC01.03 — Botão Ajuda [A2, REQ0046].
 * CA-01.03.12 [E3] — ainda não há conteúdo de ajuda cadastrado por funcionalidade,
 * então o fallback é sempre exibido. Quando o catálogo de ajuda existir, este
 * componente passa a receber um `funcionalidadeId` e buscar o conteúdo correspondente.
 */
export function BotaoAjuda() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="rounded border px-3 py-1 text-sm">
        Ajuda
      </button>

      {aberto && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
          <div className="w-full max-w-xs space-y-4 rounded-lg bg-white p-6 dark:bg-gray-900">
            <p>Conteúdo de ajuda não disponível para esta funcionalidade.</p>
            <div className="flex justify-end">
              <button type="button" onClick={() => setAberto(false)} className="rounded bg-blue-600 px-4 py-2 text-white">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
