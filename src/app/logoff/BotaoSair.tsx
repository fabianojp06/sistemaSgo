'use client';

import { useClerk } from '@clerk/nextjs';
import { useState, useTransition } from 'react';
import { efetuarLogoff } from './actions';

/**
 * UC01.04 — Efetuar Logoff.
 * CA-01.04.01 — confirmação obrigatória antes de qualquer encerramento de sessão.
 * CA-01.04.02 — ordem: revoga sessão + audita no servidor, depois invalida o token
 * no cliente (signOut do Clerk) e só então redireciona [E1: prossegue mesmo se o
 * servidor falhar, para não prender o usuário na tela principal].
 * CA-01.04.07/08 — cancelar fecha o modal sem alterar nada da sessão/tela.
 */
export function BotaoSair() {
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();
  const { signOut } = useClerk();

  function confirmarLogoff() {
    startTransition(async () => {
      try {
        await efetuarLogoff();
      } catch {
        // Bundle desatualizado após deploy [CA-01.04.09/10]: a Server Action pode
        // rejeitar antes do finally rodar. O logoff no cliente deve prosseguir mesmo assim.
      } finally {
        // Sessão do servidor já foi revogada em efetuarLogoff() acima. Não aguardamos
        // signOut() aqui: sua promise pode nunca resolver quando o fetch de RSC
        // interno do Clerk falha [ambiente/proxy], travando a navegação. Disparamos
        // best-effort e navegamos imediatamente de qualquer forma [E1 — CA-01.04.09/10].
        signOut().catch(() => {});
        window.location.href = '/login';
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="rounded-[7px] border border-[#DDE2EA] px-4 py-1.5 text-sm text-[#5B6270] hover:border-[#C43D3D] hover:text-[#C43D3D] dark:border-[#2B303C] dark:text-[#A4AAB6] dark:hover:border-[#E0716B] dark:hover:text-[#E0716B]"
      >
        Sair
      </button>

      {confirmando && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
          <div className="w-full max-w-xs space-y-4 rounded-[10px] border border-[#DDE2EA] bg-white p-6 dark:border-[#2B303C] dark:bg-[#191D26]">
            <p className="text-[#1A1F29] dark:text-[#EBEDF2]">Deseja realmente sair?</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="rounded-[7px] border border-[#DDE2EA] px-4 py-2 text-[#5B6270] dark:border-[#2B303C] dark:text-[#A4AAB6]"
              >
                Não
              </button>
              <button
                type="button"
                onClick={confirmarLogoff}
                disabled={pending}
                className="rounded-[7px] bg-[#2B5FD9] px-4 py-2 text-white disabled:opacity-50 dark:bg-[#6D93F0] dark:text-[#12151C]"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
