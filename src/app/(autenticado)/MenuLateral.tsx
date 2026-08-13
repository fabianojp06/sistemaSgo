'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ModuloMenu } from '@/application/use-cases/menu/ObterMenuUsuarioUseCase';

const ROTA_POR_FUNCIONALIDADE: Record<string, string> = {
  'plano-contas.visualizar': '/plano-contas',
  'plano-contas.sincronizar': '/plano-contas',
  'propostas.visualizar': '/propostas',
  'orcamentario.visualizar': '/orcamentario',
  'orcamentario.premissas-reajustes.visualizar': '/orcamentario#premissas-reajustes',
  'aliquotas-impostos.visualizar': '/aliquotas-impostos',
  'tabela-salarial.visualizar': '/tabela-salarial',
};

/**
 * UC01.03 — menu lateral com módulos retraídos por padrão; clicar no cabeçalho
 * do módulo expande/recolhe seus submódulos (toggle independente por módulo,
 * múltiplos podem ficar abertos ao mesmo tempo — mesmo padrão de accordion
 * não-exclusivo já usado em NoArvore/MenuAcoesProposta). Extraído de page.tsx
 * (Server Component) porque o estado de aberto/fechado exige client.
 */
export function MenuLateral({ menu }: { menu: ModuloMenu[] }) {
  const [modulosAbertos, setModulosAbertos] = useState<Set<string>>(new Set());

  function alternar(chave: string) {
    setModulosAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  }

  return (
    <nav className="w-64 border-r border-[#DDE2EA] bg-white p-4 dark:border-[#2B303C] dark:bg-[#191D26]">
      <ul className="flex flex-col gap-1">
        {menu.map((modulo) => {
          const navegaveis = modulo.funcionalidades.filter((f) => f.tipo === 'NAVEGAVEL');
          if (navegaveis.length === 0) return null;

          const aberto = modulosAbertos.has(modulo.chave);

          return (
            <li key={modulo.chave} className="flex flex-col">
              <button
                type="button"
                onClick={() => alternar(modulo.chave)}
                aria-expanded={aberto}
                className="flex items-center gap-2 rounded-[6px] px-1 py-1.5 text-left hover:bg-[#EEF1F6] dark:hover:bg-[#1F2430]"
              >
                <span className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[6px] bg-[#E8EEFC] text-[0.65rem] font-semibold text-[#2B5FD9] dark:bg-[#1D2A48] dark:text-[#6D93F0]">
                  {modulo.nome.charAt(0).toUpperCase()}
                </span>
                <p className="flex-1 font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">{modulo.nome}</p>
                <span className="text-xs text-[#8A8F98] dark:text-[#767C89]">{aberto ? '▾' : '▸'}</span>
              </button>
              {aberto && (
                <ul className="flex flex-col gap-0.5 py-1 pl-[30px] text-sm">
                  {navegaveis.map((funcionalidade) => {
                    const href = ROTA_POR_FUNCIONALIDADE[funcionalidade.chave];
                    return (
                      <li key={funcionalidade.chave}>
                        {href ? (
                          <Link
                            href={href}
                            className="block rounded-[6px] px-2 py-1 text-[#5B6270] hover:bg-[#E8EEFC] hover:text-[#2B5FD9] dark:text-[#A4AAB6] dark:hover:bg-[#1D2A48] dark:hover:text-[#6D93F0]"
                          >
                            {funcionalidade.nome}
                          </Link>
                        ) : (
                          <span className="block px-2 py-1 text-[#8A8F98] dark:text-[#767C89]">{funcionalidade.nome}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
