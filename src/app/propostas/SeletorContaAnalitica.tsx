'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ContaOpcao = { id: string; label: string };

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const MIN_CARACTERES_BUSCA = 3;
const MAX_OPCOES_SEM_BUSCA = 30;

/**
 * Combobox de conta contábil com busca por nome ou código (label já é
 * `${codigoErp} — ${nomeConta}`), sem lib externa — mesmo padrão do resto do
 * projeto (BarChartHorizontal, ícones SVG inline). Controlado como um select
 * comum: `value` é o id da conta, `onChange(id)` dispara ao selecionar.
 */
export function SeletorContaAnalitica({
  contas,
  value,
  onChange,
  placeholder = 'Buscar conta por nome ou código...',
}: {
  contas: ContaOpcao[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const contaSelecionada = contas.find((c) => c.id === value) ?? null;

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (ref.current && !ref.current.contains(evento.target as Node)) {
        setAberto(false);
        setBusca('');
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  const opcoesFiltradas = useMemo(() => {
    if (busca.trim().length < MIN_CARACTERES_BUSCA) return contas.slice(0, MAX_OPCOES_SEM_BUSCA);
    const buscaNormalizada = normalizar(busca.trim());
    return contas.filter((c) => normalizar(c.label).includes(buscaNormalizada));
  }, [contas, busca]);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={aberto ? busca : (contaSelecionada?.label ?? '')}
        onChange={(e) => setBusca(e.target.value)}
        onFocus={() => {
          setAberto(true);
          setBusca('');
        }}
        placeholder={placeholder}
        className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
      />
      {aberto && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border border-gray-100 bg-white shadow-sm">
          {opcoesFiltradas.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-500">Nenhuma conta encontrada.</p>
          ) : (
            opcoesFiltradas.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setAberto(false);
                  setBusca('');
                }}
                className={`block w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50 ${c.id === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700'}`}
              >
                {c.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
