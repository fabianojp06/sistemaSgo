'use client';

import { useState, useTransition } from 'react';
import { cadastrarViagem, excluirViagem, type ViagemResultado } from '@/app/plano-contas/actions';

type ContaOpcao = { id: string; label: string };

function NovaViagemForm({
  versaoId,
  contasAnaliticas,
  readOnly,
  onCriada,
}: {
  versaoId: string;
  contasAnaliticas: ContaOpcao[];
  readOnly?: boolean;
  onCriada: (resultado: ViagemResultado) => void;
}) {
  const [descricao, setDescricao] = useState('');
  const [quantidadePessoas, setQuantidadePessoas] = useState(1);
  const [mediaDias, setMediaDias] = useState(1);
  const [custoUnitarioPassagem, setCustoUnitarioPassagem] = useState(0);
  const [contaPassagemId, setContaPassagemId] = useState(contasAnaliticas[0]?.id ?? '');
  const [custoUnitarioDiaria, setCustoUnitarioDiaria] = useState(0);
  const [contaDiariaId, setContaDiariaId] = useState(contasAnaliticas[0]?.id ?? '');
  const [custoUnitarioTransporte, setCustoUnitarioTransporte] = useState(0);
  const [contaTransporteId, setContaTransporteId] = useState(contasAnaliticas[0]?.id ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (readOnly) return null;
  if (contasAnaliticas.length === 0) return <p className="text-sm text-gray-500">Nenhuma conta analítica disponível.</p>;

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await cadastrarViagem({
        versaoId,
        descricao,
        quantidadePessoas,
        mediaDias,
        custoUnitarioPassagem,
        contaPassagemId,
        custoUnitarioDiaria,
        contaDiariaId,
        custoUnitarioTransporte,
        contaTransporteId,
      });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setDescricao('');
      onCriada(resposta.dados);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <h4 className="text-sm font-medium">Nova Viagem</h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">Descrição</label>
          <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={100} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Quantidade de Pessoas</label>
          <input type="number" min={1} value={quantidadePessoas} onChange={(e) => setQuantidadePessoas(Number(e.target.value))} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Média de Dias</label>
          <input type="number" min={1} value={mediaDias} onChange={(e) => setMediaDias(Number(e.target.value))} className="w-full rounded border px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Custo Unit. Passagem</label>
          <input type="number" min={0} step="0.01" value={custoUnitarioPassagem} onChange={(e) => setCustoUnitarioPassagem(Number(e.target.value))} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Conta — Passagem</label>
          <select value={contaPassagemId} onChange={(e) => setContaPassagemId(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
            {contasAnaliticas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div />

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Custo Unit. Diária</label>
          <input type="number" min={0} step="0.01" value={custoUnitarioDiaria} onChange={(e) => setCustoUnitarioDiaria(Number(e.target.value))} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Conta — Diária</label>
          <select value={contaDiariaId} onChange={(e) => setContaDiariaId(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
            {contasAnaliticas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div />

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Custo Unit. Transporte</label>
          <input type="number" min={0} step="0.01" value={custoUnitarioTransporte} onChange={(e) => setCustoUnitarioTransporte(Number(e.target.value))} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Conta — Transporte</label>
          <select value={contaTransporteId} onChange={(e) => setContaTransporteId(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
            {contasAnaliticas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
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

/** US-109/US-115 — Viagens (exclusiva de Proposta POR_META; o use case bloqueia se não for). */
export function ViagemPanel({
  versaoId,
  contasAnaliticas,
  viagensIniciais = [],
  readOnly,
}: {
  versaoId: string;
  contasAnaliticas: ContaOpcao[];
  viagensIniciais?: ViagemResultado[];
  readOnly?: boolean;
}) {
  const [viagens, setViagens] = useState(viagensIniciais);
  const [pending, startTransition] = useTransition();

  function excluir(viagemId: string) {
    startTransition(async () => {
      const resposta = await excluirViagem(viagemId);
      if (resposta.sucesso) setViagens((atual) => atual.filter((v) => v.id !== viagemId));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-medium">Viagens</h3>
      <NovaViagemForm versaoId={versaoId} contasAnaliticas={contasAnaliticas} readOnly={readOnly} onCriada={(v) => setViagens((atual) => [...atual, v])} />
      {viagens.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma Viagem cadastrada.</p>
      ) : (
        <ul className="divide-y rounded border">
          {viagens.map((viagem) => (
            <li key={viagem.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                {viagem.descricao} — <span className="text-xs text-gray-500">custo estimado R$ {viagem.custoEstimado}</span>
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => excluir(viagem.id)}
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
