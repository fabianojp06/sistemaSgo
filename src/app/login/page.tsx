'use client';

import { useSignIn } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef } from 'react';
import { efetuarLogin, type EfetuarLoginState } from './actions';

const estadoInicial: EfetuarLoginState = {};

// UC01.01 — Efetuar Login [CA-01.01.01: campos Login/Senha, botões Entrar/Cancelar, link "Esqueci minha senha"]
export default function LoginPage() {
  const [state, formAction, pending] = useActionState(efetuarLogin, estadoInicial);
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const tokenTrocado = useRef<string | null>(null);

  useEffect(() => {
    const signInToken = state.signInToken;
    if (!signInToken || !isLoaded || tokenTrocado.current === signInToken) {
      return;
    }
    tokenTrocado.current = signInToken;

    (async () => {
      const tentativa = await signIn.create({ strategy: 'ticket', ticket: signInToken });
      await setActive({ session: tentativa.createdSessionId });
      router.push('/'); // Tela Principal [UC01.03]
    })();
  }, [state.signInToken, isLoaded, signIn, setActive, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg border p-6">
        <h1 className="text-lg font-semibold">Acessar o SGO</h1>

        <div className="space-y-1">
          <label htmlFor="login" className="block text-sm font-medium">
            Login
          </label>
          <input
            id="login"
            name="login"
            type="text"
            autoComplete="username"
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="senha" className="block text-sm font-medium">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            className="w-full rounded border px-3 py-2"
          />
        </div>

        {state.erro && (
          <p role="alert" className="text-sm text-red-600">
            {state.erro}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <button type="submit" disabled={pending} className="rounded bg-blue-600 px-4 py-2 text-white">
            Entrar
          </button>
          <button type="reset" className="rounded border px-4 py-2">
            Cancelar
          </button>
        </div>

        <a href="/esqueci-minha-senha" className="block text-sm text-blue-600 underline">
          Esqueci minha senha
        </a>
      </form>
    </main>
  );
}
