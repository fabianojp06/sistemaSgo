'use client';

import { useEffect, useState } from 'react';
import { TAMANHO_MINIMO_TERMO, useBuscaCargoMercadoCatalogo } from './useBuscaCargoMercadoCatalogo';

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
 * (AutocompleteCargoMercado): mesma fonte, mesma busca (useBuscaCargoMercadoCatalogo),
 * nenhuma escrita — quem persiste é o formulário/modal chamador, ao salvar.
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
  const { sugestoes, buscando, buscar } = useBuscaCargoMercadoCatalogo();

  // Fecha com Esc (mesmo contrato dos demais modais desta tela).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onFechar]);

  function handleChange(novoValor: string) {
    setTermo(novoValor);
    buscar(novoValor);
  }

  const termoCurto = termo.trim().length < TAMANHO_MINIMO_TERMO;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onFechar}
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
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
            {!termoCurto && !buscando && sugestoes && sugestoes.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-500">Nenhum cargo encontrado no catálogo para este termo.</p>
            )}
            {!termoCurto &&
              !buscando &&
              sugestoes?.map((candidato) => (
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
