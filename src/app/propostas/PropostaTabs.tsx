'use client';

import Link from 'next/link';

type Guia = { slug: string; label: string };

/** US-115 — navegação por abas, deep-link via segmento de URL (Cenário 2). */
export function PropostaTabs({ propostaId, guias, guiaAtiva }: { propostaId: string; guias: readonly Guia[]; guiaAtiva: string }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {guias.map((guia) => {
        const ativa = guia.slug === guiaAtiva;
        const href = `/propostas/${propostaId}/${guia.slug}`;
        return (
          <Link
            key={guia.slug}
            href={href}
            aria-current={ativa ? 'page' : undefined}
            className={`rounded-t px-3 py-1.5 text-sm ${
              ativa ? 'border-b-2 border-blue-600 font-medium text-blue-700' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {guia.label}
          </Link>
        );
      })}
    </nav>
  );
}
