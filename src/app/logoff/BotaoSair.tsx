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
      <button type="button" onClick={() => setConfirmando(true)} className="rounded border px-4 py-2">
        Sair
      </button>

      {confirmando && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
          <div className="w-full max-w-xs space-y-4 rounded-lg bg-white p-6 dark:bg-gray-900">
            <p>Deseja realmente sair?</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmando(false)} className="rounded border px-4 py-2">
                Não
              </button>
              <button
                type="button"
                onClick={confirmarLogoff}
                disabled={pending}
                className="rounded bg-blue-600 px-4 py-2 text-white"
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
