'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { buscarCargoMercadoCatalogo, type CandidatoCargoMercadoResultado } from './estrutura-actions';

export const DEBOUNCE_MS = 300;
export const TAMANHO_MINIMO_TERMO = 2;

/**
 * ADR-047 (US-139) — busca debounced no Catálogo de Cargo de Mercado, com o
 * guard de resposta fora de ordem (descarta resultado de um termo que já não é
 * o atual — lição do bug de debounce, coberto por CT-139-11).
 *
 * Fonte única desse comportamento para os dois pontos de uso: o autocomplete
 * embutido (AutocompleteCargoMercado) e o modal do botão "Importar Cargo"
 * (BotaoImportarCargoMercado). Cada componente cuida do seu próprio input e do
 * estado de abertura; este hook só cuida da busca.
 */
export function useBuscaCargoMercadoCatalogo() {
  const [sugestoes, setSugestoes] = useState<CandidatoCargoMercadoResultado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoTermoBuscadoRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const limpar = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    ultimoTermoBuscadoRef.current = null;
    setSugestoes(null);
    setBuscando(false);
  }, []);

  /** Agenda uma busca para `valor`; abaixo do mínimo de caracteres, limpa. */
  const buscar = useCallback((valor: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const termo = valor.trim();
    if (termo.length < TAMANHO_MINIMO_TERMO) {
      ultimoTermoBuscadoRef.current = null;
      setSugestoes(null);
      setBuscando(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      ultimoTermoBuscadoRef.current = termo;
      setBuscando(true);
      const resposta = await buscarCargoMercadoCatalogo(termo);
      setBuscando(false);
      // Descarta resposta fora de ordem: só aplica se ainda é a busca atual.
      const aindaEhABuscaAtual = ultimoTermoBuscadoRef.current === termo;
      if (aindaEhABuscaAtual) {
        setSugestoes(resposta.sucesso ? resposta.dados : []);
      }
    }, DEBOUNCE_MS);
  }, []);

  return { sugestoes, buscando, buscar, limpar };
}
