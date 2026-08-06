'use client';

import { useState, useTransition } from 'react';
import { cadastrarItemPatrimonial, excluirItemPatrimonial, type ItemPatrimonialResultado } from '@/app/plano-contas/actions';

type ContaOpcao = { id: string; label: string };

function NovoItemForm({
  versaoId,
  contasAnaliticas,
  readOnly,
  onCriado,
}: {
  versaoId: string;
  contasAnaliticas: ContaOpcao[];
  readOnly?: boolean;
  onCriado: (resultado: ItemPatrimonialResultado) => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [descricao, setDescricao] = useState('');
  const [contaId, setContaId] = useState(contasAnaliticas[0]?.id ?? '');
  const [data, setData] = useState(hoje);
  const [quantidade, setQuantidade] = useState(1);
  const [valorUnitario, setValorUnitario] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (readOnly) return null;
  if (contasAnaliticas.length === 0) return <p className="text-sm text-gray-500">Nenhuma conta analítica disponível.</p>;

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await cadastrarItemPatrimonial({ versaoId, contaId, descricao, data, quantidade, valorUnitario });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setDescricao('');
      onCriado(resposta.dados);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <h4 className="text-sm font-medium">Novo Item</h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-600">Descrição</label>
          <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={100} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Conta Analítica</label>
          <select value={contaId} onChange={(e) => setContaId(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
            {contasAnaliticas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Data</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Quantidade</label>
          <input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Valor Unitário (R$)</label>
          <input type="number" min={0} step="0.01" value={valorUnitario} onChange={(e) => setValorUnitario(Number(e.target.value))} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div>
        <button
          type="button"
          onClick={salvar}
          disabled={pending || descricao.trim().length === 0}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Cadastrar'}
        </button>
      </div>
    </div>
  );
}

/** US-110/US-115 — Bens, Serviços e Equipamentos. */
export function ItemPatrimonialPanel({
  versaoId,
  contasAnaliticas,
  itensIniciais = [],
  readOnly,
}: {
  versaoId: string;
  contasAnaliticas: ContaOpcao[];
  itensIniciais?: ItemPatrimonialResultado[];
  readOnly?: boolean;
}) {
  const [itens, setItens] = useState(itensIniciais);
  const [pending, startTransition] = useTransition();

  function excluir(itemPatrimonialId: string) {
    startTransition(async () => {
      const resposta = await excluirItemPatrimonial(itemPatrimonialId);
      if (resposta.sucesso) setItens((atual) => atual.filter((i) => i.id !== itemPatrimonialId));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-medium">Bens, Serviços e Equipamentos</h3>
      <NovoItemForm versaoId={versaoId} contasAnaliticas={contasAnaliticas} readOnly={readOnly} onCriado={(i) => setItens((atual) => [...atual, i])} />
      {itens.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum item cadastrado.</p>
      ) : (
        <ul className="divide-y rounded border">
          {itens.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                {item.descricao} — <span className="text-xs text-gray-500">total R$ {item.valorTotal}</span>
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => excluir(item.id)}
                  disabled={pending}
                  className="rounded border px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                >
                  Excluir
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
