'use client';

import { useEffect, useRef, useState } from 'react';
import { buscarCargoMercadoCatalogo, type CandidatoCargoMercadoResultado } from './estrutura-actions';

const DEBOUNCE_MS = 300;
const TAMANHO_MINIMO_TERMO = 2;

type Props = {
  /** Chamado com o nome do cargo escolhido no catálogo. */
  onSelecionar: (nome: string) => void;
  /** Rótulo do botão (default "Importar Cargo"). */
  rotulo?: string;
  className?: string;
};

/**
 * ADR-047 (US-139) — botão explícito "Importar Cargo" que abre um modal de
 * busca no Catálogo de Cargo de Mercado (RH) e devolve o nome escolhido via
 * `onSelecionar`. Alternativa mais visível ao autocomplete embutido
 * (AutocompleteCargoMercado): mesma fonte, mesma Server Action de leitura
 * (`buscarCargoMercadoCatalogo`), nenhuma escrita — quem persiste é o
 * formulário/modal chamador, ao salvar o Cargo.
 *
 * Reutilizável em qualquer tela: hoje no formulário de Cargo (CargoPanel) e
 * na seção "Cadastrar Cargo" do modal de Tabela Salarial (TabelaSalarialModal).
 */
export function BotaoImportarCargoMercado({ onSelecionar, rotulo = 'Importar Cargo', className }: Props) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={
          className ??
          'whitespace-nowrap rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50'
        }
        title="Buscar e importar o nome do cargo a partir do Catálogo de Cargo de Mercado (RH)"
      >
        {rotulo}
      </button>
      {aberto && (
        <ImportarCargoMercadoModal
          onFechar={() => setAberto(false)}
          onSelecionar={(nome) => {
            onSelecionar(nome);
            setAberto(false);
          }}
        />
      )}
    </>
  );
}

function ImportarCargoMercadoModal({
  onFechar,
  onSelecionar,
}: {
  onFechar: () => void;
  onSelecionar: (nome: string) => void;
}) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<CandidatoCargoMercadoResultado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoTermoBuscadoRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(novoValor: string) {
    setTermo(novoValor);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const termoNormalizado = novoValor.trim();
    if (termoNormalizado.length < TAMANHO_MINIMO_TERMO) {
      ultimoTermoBuscadoRef.current = null;
      setResultados(null);
      setBuscando(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      ultimoTermoBuscadoRef.current = termoNormalizado;
      setBuscando(true);
      const resposta = await buscarCargoMercadoCatalogo(termoNormalizado);
      // Descarta resposta fora de ordem: só aplica se ainda é a busca atual
      // (mesma lição do bug de debounce da US-139).
      const aindaEhABuscaAtual = ultimoTermoBuscadoRef.current === termoNormalizado;
      if (!aindaEhABuscaAtual) return;
      setBuscando(false);
      setResultados(resposta.sucesso ? resposta.dados : []);
    }, DEBOUNCE_MS);
  }

  const termoCurto = termo.trim().length < TAMANHO_MINIMO_TERMO;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Importar Cargo do catálogo</h3>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <div>
            <input
              type="text"
              autoFocus
              value={termo}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Buscar cargo no catálogo (mín. 2 caracteres)…"
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>

          <div className="min-h-[6rem] overflow-y-auto rounded border border-gray-100">
            {termoCurto && (
              <p className="px-3 py-2 text-xs text-gray-400">Digite ao menos 2 caracteres para buscar.</p>
            )}
            {!termoCurto && buscando && <p className="px-3 py-2 text-xs text-gray-400">Buscando…</p>}
            {!termoCurto && !buscando && resultados && resultados.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-500">
                Nenhum cargo encontrado no catálogo. Se o catálogo ainda não foi carregado, sincronize o
                Catálogo de Cargo de Mercado na tela de <span className="font-medium">Plano de Contas</span>.
              </p>
            )}
            {!termoCurto &&
              !buscando &&
              resultados?.map((candidato) => (
                <button
                  key={candidato.codigoOrigem}
                  type="button"
                  onClick={() => onSelecionar(candidato.nome)}
                  className="block w-full border-b border-gray-50 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-blue-50"
                >
                  {candidato.nome}
                </button>
              ))}
          </div>
        </div>

        <div className="flex justify-end border-t px-5 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
