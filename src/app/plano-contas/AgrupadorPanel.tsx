'use client';

import { useState, useTransition } from 'react';
import { criarAgrupador, editarAgrupador, excluirAgrupador } from './actions';

type Agrupador = { id: string; nome: string; contaIds: string[]; total: string };
type ContaOpcao = { id: string; label: string };

type ModalState = { modo: 'novo' } | { modo: 'editar'; agrupador: Agrupador } | { modo: 'excluir'; agrupador: Agrupador } | null;

/** UC03.00 / A2-A4 — CRUD de Agrupadores de Contas (RF_PLA_REQ_005). */
export function AgrupadorPanel({ agrupadores, contasAnaliticas }: { agrupadores: Agrupador[]; contasAnaliticas: ContaOpcao[] }) {
  const [modal, setModal] = useState<ModalState>(null);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          onClick={() => setModal({ modo: 'novo' })}
          className="rounded border px-3 py-1.5 text-sm font-medium"
        >
          Novo Agrupador
        </button>
      </div>

      {agrupadores.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum Agrupador cadastrado.</p>
      ) : (
        <ul className="divide-y rounded border">
          {agrupadores.map((agrupador) => (
            <li key={agrupador.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{agrupador.nome}</p>
                <p className="text-xs text-gray-500">
                  {agrupador.contaIds.length} conta(s) — Total: {agrupador.total}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setModal({ modo: 'editar', agrupador })} className="text-xs text-blue-600">
                  Editar
                </button>
                <button type="button" onClick={() => setModal({ modo: 'excluir', agrupador })} className="text-xs text-red-600">
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal?.modo === 'novo' && (
        <AgrupadorFormModal contasAnaliticas={contasAnaliticas} onFechar={() => setModal(null)} />
      )}
      {modal?.modo === 'editar' && (
        <AgrupadorFormModal contasAnaliticas={contasAnaliticas} agrupador={modal.agrupador} onFechar={() => setModal(null)} />
      )}
      {modal?.modo === 'excluir' && (
        <ExcluirAgrupadorModal agrupador={modal.agrupador} onFechar={() => setModal(null)} />
      )}
    </div>
  );
}

function AgrupadorFormModal({
  agrupador,
  contasAnaliticas,
  onFechar,
}: {
  agrupador?: Agrupador;
  contasAnaliticas: ContaOpcao[];
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(agrupador?.nome ?? '');
  const [selecionadas, setSelecionadas] = useState<string[]>(agrupador?.contaIds ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function alternarConta(id: string) {
    setSelecionadas((atual) => (atual.includes(id) ? atual.filter((c) => c !== id) : [...atual, id]));
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resultado = agrupador
        ? await editarAgrupador(agrupador.id, nome, selecionadas)
        : await criarAgrupador(nome, selecionadas);

      if (!resultado.sucesso) {
        setErro(resultado.mensagem);
        return;
      }
      onFechar();
    });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded bg-white p-4 shadow-lg">
        <h3 className="mb-3 font-medium">{agrupador ? 'Editar Agrupador' : 'Novo Agrupador'}</h3>

        <label className="mb-1 block text-xs font-medium text-gray-600">Nome do Agrupador</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mb-3 w-full rounded border px-2 py-1 text-sm"
          placeholder="ex.: Despesas com passagens aéreas"
        />

        <label className="mb-1 block text-xs font-medium text-gray-600">Contas Analíticas</label>
        <div className="mb-3 max-h-48 overflow-y-auto rounded border p-2">
          {contasAnaliticas.map((conta) => (
            <label key={conta.id} className="flex items-center gap-2 py-0.5 text-sm">
              <input type="checkbox" checked={selecionadas.includes(conta.id)} onChange={() => alternarConta(conta.id)} />
              {conta.label}
            </label>
          ))}
        </div>

        {erro && <p className="mb-2 text-xs text-red-600">{erro}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded border px-3 py-1.5 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={pending}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Salvar Agrupador
          </button>
        </div>
      </div>
    </div>
  );
}

function ExcluirAgrupadorModal({ agrupador, onFechar }: { agrupador: Agrupador; onFechar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await excluirAgrupador(agrupador.id);
      if (!resultado.sucesso) {
        setErro(resultado.mensagem);
        return;
      }
      onFechar();
    });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-sm rounded bg-white p-4 shadow-lg">
        <p className="mb-3 text-sm">
          Deseja excluir o Agrupador <strong>{agrupador.nome}</strong>? Esta ação removerá o subtotal correspondente de
          todos os relatórios vinculados.
        </p>
        {erro && <p className="mb-2 text-xs text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded border px-3 py-1.5 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={pending}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
