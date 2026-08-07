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
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded-[7px] border border-[#DDE2EA] px-3 py-1.5 text-sm text-[#5B6270] hover:border-[#2B5FD9] hover:text-[#2B5FD9] dark:border-[#2B303C] dark:text-[#A4AAB6] dark:hover:border-[#6D93F0] dark:hover:text-[#6D93F0]"
      >
        Ajuda
      </button>

      {aberto && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
          <div className="w-full max-w-xs space-y-4 rounded-[10px] border border-[#DDE2EA] bg-white p-6 dark:border-[#2B303C] dark:bg-[#191D26]">
            <p className="text-[#1A1F29] dark:text-[#EBEDF2]">Conteúdo de ajuda não disponível para esta funcionalidade.</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-[7px] bg-[#2B5FD9] px-4 py-2 text-white dark:bg-[#6D93F0] dark:text-[#12151C]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
