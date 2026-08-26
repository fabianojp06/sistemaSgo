'use client';

import { useEffect, useRef, useState } from 'react';
import { buscarCargoMercadoCatalogo, type CandidatoCargoMercadoResultado } from './estrutura-actions';

const DEBOUNCE_MS = 300;
const TAMANHO_MINIMO_TERMO = 2;

type Props = {
  value: string;
  onChange: (valor: string) => void;
};

/**
 * ADR-047 (US-139) — autocomplete embutido no campo "Nome do Cargo (Mercado)".
 * Sugestões vêm do Catálogo de Cargo de Mercado (RH), fonte independente da
 * importação Rubi/CTCEA. Nunca sobrescreve o campo sozinho: só sugere, e só
 * preenche no clique explícito do usuário — o campo continua sempre editável
 * livremente antes e depois (mesma lição do bug de nomeCargoCtcea, 2026-08-15).
 */
export function AutocompleteCargoMercado({ value, onChange }: Props) {
  const [sugestoes, setSugestoes] = useState<CandidatoCargoMercadoResultado[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoTermoBuscadoRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(novoValor: string) {
    onChange(novoValor);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const termo = novoValor.trim();
    if (termo.length < TAMANHO_MINIMO_TERMO) {
      ultimoTermoBuscadoRef.current = null;
      setSugestoes(null);
      setAberto(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      ultimoTermoBuscadoRef.current = termo;
      setBuscando(true);
      const resposta = await buscarCargoMercadoCatalogo(termo);
      const aindaEhABuscaAtual = ultimoTermoBuscadoRef.current === termo;
      setBuscando(false);
      if (resposta.sucesso && aindaEhABuscaAtual) {
        setSugestoes(resposta.dados);
        setAberto(true);
      }
    }, DEBOUNCE_MS);
  }

  function selecionar(candidato: CandidatoCargoMercadoResultado) {
    onChange(candidato.nome);
    setAberto(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => sugestoes && sugestoes.length > 0 && setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        className="w-full rounded border px-2 py-1 text-sm"
      />
      <p className="mt-1 text-[11px] text-gray-400">Digite ou selecione do catálogo de Cargo de Mercado (RH)</p>

      {aberto && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
          {buscando && <p className="px-2 py-1.5 text-xs text-gray-400">Buscando…</p>}
          {!buscando && sugestoes && sugestoes.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-gray-400">Nenhum cargo encontrado no catálogo.</p>
          )}
          {!buscando &&
            sugestoes?.map((candidato) => (
              <button
                key={candidato.codigoOrigem}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selecionar(candidato)}
                className="block w-full px-2 py-1.5 text-left text-xs hover:bg-blue-50"
              >
                {candidato.nome}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
