'use client';

import Link from 'next/link';

type Guia = { slug: string; label: string };

/**
 * US-115 — navegação por abas, deep-link via segmento de URL (Cenário 2).
 *
 * Layout "pasta de arquivo": a aba ativa recebe fundo branco + borda nos 3
 * lados (exceto embaixo), com `-mb-px` para sobrepor a `border-b` do `nav` e
 * "abrir" a folha em direção ao painel de conteúdo abaixo — dá a impressão de
 * uma única superfície contínua entre a aba ativa e o conteúdo. As abas
 * inativas ficam recuadas (fundo cinza claro, sem borda), como se estivessem
 * atrás da folha erguida.
 */
export function PropostaTabs({ propostaId, guias, guiaAtiva }: { propostaId: string; guias: readonly Guia[]; guiaAtiva: string }) {
  return (
    <nav className="flex flex-wrap items-end gap-1 border-b border-gray-200">
      {guias.map((guia) => {
        const ativa = guia.slug === guiaAtiva;
        const href = `/propostas/${propostaId}/${guia.slug}`;
        return (
          <Link
            key={guia.slug}
            href={href}
            aria-current={ativa ? 'page' : undefined}
            className={`-mb-px rounded-t-lg border px-3 py-2 text-sm transition-colors ${
              ativa
                ? 'border-gray-200 border-b-white bg-white font-medium text-blue-700'
                : 'border-transparent bg-slate-100 text-gray-500 hover:bg-slate-200 hover:text-gray-800'
            }`}
          >
            {guia.label}
          </Link>
        );
      })}
    </nav>
  );
}
