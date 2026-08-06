'use client';

import { useState, useTransition } from 'react';
import { cadastrarMeta, editarMeta, type MetaResultado } from '@/app/plano-contas/actions';

type MetaInicial = { id: string; tipo: string; nome: string; valorGlobal: string; status: 'ATIVO' | 'INATIVO'; observacao: string | null };

/** US-112/US-115 — Meta é 1:1 opcional por Versão (ADR-017): existe no máximo 1 registro. */
export function MetaPanel({ versaoId, metaInicial, readOnly }: { versaoId: string; metaInicial: MetaInicial | null; readOnly?: boolean }) {
  const [meta, setMeta] = useState(metaInicial);
  const [tipo, setTipo] = useState(metaInicial?.tipo ?? '');
  const [nome, setNome] = useState(metaInicial?.nome ?? '');
  const [status, setStatus] = useState<'ATIVO' | 'INATIVO'>(metaInicial?.status ?? 'ATIVO');
  const [observacao, setObservacao] = useState(metaInicial?.observacao ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function aplicarResultado(resultado: MetaResultado) {
    setMeta((atual) => ({
      id: resultado.id,
      tipo: atual?.tipo ?? tipo,
      nome: resultado.nome,
      valorGlobal: resultado.valorGlobal,
      status: resultado.status,
      observacao: atual?.observacao ?? observacao,
    }));
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resposta = meta
        ? await editarMeta({ metaId: meta.id, nome, status, observacao: observacao || null })
        : await cadastrarMeta({ versaoId, tipo, nome, status, observacao: observacao || null });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      aplicarResultado(resposta.dados);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <h3 className="font-medium">Meta</h3>

      {meta && (
        <p className="text-xs text-gray-500">
          Valor Global (sempre espelhado do Valor Orçado): <span className="font-medium text-gray-700">R$ {meta.valorGlobal}</span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
          <input
            type="text"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            disabled={readOnly || !!meta}
            className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={readOnly}
            className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'ATIVO' | 'INATIVO')}
            disabled={readOnly}
            className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50"
          >
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Observação</label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          disabled={readOnly}
          className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50"
          rows={2}
        />
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {!readOnly && (
        <div>
          <button
            type="button"
            onClick={salvar}
            disabled={pending || nome.trim().length === 0 || (!meta && tipo.trim().length === 0)}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {pending ? 'Salvando...' : meta ? 'Salvar' : 'Criar Meta'}
          </button>
        </div>
      )}
    </div>
  );
}
