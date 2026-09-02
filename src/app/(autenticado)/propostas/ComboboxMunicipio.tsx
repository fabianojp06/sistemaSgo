'use client';

import { useEffect, useMemo, useState } from 'react';
import { carregarMunicipiosBr, filtrarMunicipios, type MunicipioOpcao } from './municipios-br-client';

export type MunicipioSelecionado = { codigoIbge: string; nome: string; uf: string };

type Props = {
  /** Código IBGE atualmente selecionado ('' quando nenhum). */
  codigoIbge: string;
  /** Rótulo "Nome — UF" do município já gravado (viagem carregada), quando houver. */
  rotuloInicial: string | null;
  onChange: (selecionado: MunicipioSelecionado | null) => void;
  disabled?: boolean;
};

/**
 * US-141 / ADR-048 — seletor de município (catálogo IBGE embutido). Busca 100%
 * client-side: os ~5.571 municípios entram por import() dinâmico e ficam em cache
 * de módulo. Filtro por nome, acento- e caixa-insensível, mínimo 2 caracteres,
 * teto de 20 resultados. Não há Server Action de busca.
 */
export function ComboboxMunicipio({ codigoIbge, rotuloInicial, onChange, disabled }: Props) {
  const [catalogo, setCatalogo] = useState<MunicipioOpcao[] | null>(null);
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    carregarMunicipiosBr()
      .then((c) => {
        if (vivo) setCatalogo(c);
      })
      .catch(() => {
        if (vivo) setCatalogo([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const resultados = useMemo(
    () => (catalogo ? filtrarMunicipios(catalogo, termo) : []),
    [catalogo, termo],
  );

  const rotuloSelecionado = useMemo(() => {
    if (codigoIbge.length === 0) return null;
    const doCatalogo = catalogo?.find((m) => m.codigoIbge === codigoIbge);
    return doCatalogo?.rotulo ?? rotuloInicial;
  }, [codigoIbge, catalogo, rotuloInicial]);

  if (codigoIbge.length > 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate rounded border border-gray-200 bg-slate-50 px-2 py-1 text-sm">
          {rotuloSelecionado ?? codigoIbge}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setTermo('');
            }}
            className="rounded border border-gray-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Trocar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={termo}
        disabled={disabled || catalogo === null}
        placeholder={catalogo === null ? 'Carregando municípios…' : 'Digite o nome do município'}
        onChange={(e) => {
          setTermo(e.target.value);
          setAberto(e.target.value.trim().length >= 2);
        }}
        onFocus={() => setAberto(termo.trim().length >= 2)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        className="w-full rounded border border-gray-200 px-2 py-1 text-sm disabled:bg-slate-50"
      />
      {aberto && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
          {resultados.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-gray-400">Nenhum município encontrado.</p>
          ) : (
            resultados.map((m) => (
              <button
                key={m.codigoIbge}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ codigoIbge: m.codigoIbge, nome: m.nome, uf: m.uf });
                  setTermo('');
                  setAberto(false);
                }}
                className="block w-full px-2 py-1.5 text-left text-xs hover:bg-blue-50"
              >
                {m.rotulo}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
