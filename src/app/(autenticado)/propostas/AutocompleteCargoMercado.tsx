'use client';

import { useState } from 'react';
import { TAMANHO_MINIMO_TERMO, useBuscaCargoMercadoCatalogo } from './useBuscaCargoMercadoCatalogo';

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
 *
 * A busca debounced + o guard de resposta fora de ordem vivem em
 * useBuscaCargoMercadoCatalogo, compartilhados com BotaoImportarCargoMercado.
 */
export function AutocompleteCargoMercado({ value, onChange }: Props) {
  const { sugestoes, buscando, buscar } = useBuscaCargoMercadoCatalogo();
  const [aberto, setAberto] = useState(false);

  function handleChange(novoValor: string) {
    onChange(novoValor);
    buscar(novoValor);
    setAberto(novoValor.trim().length >= TAMANHO_MINIMO_TERMO);
  }

  function selecionar(nome: string) {
    onChange(nome);
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
                onClick={() => selecionar(candidato.nome)}
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
