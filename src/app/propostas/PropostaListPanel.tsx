'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { cadastrarProposta, duplicarProposta, excluirVersaoProposta, type PropostaListada } from './actions';

const LABEL_TIPO: Record<PropostaListada['tipo'], string> = {
  CONTRATO: 'Contrato',
  TERMO_DE_PARCERIA: 'Termo de Parceria',
};

function NovaPropostaForm({ podeCriar, onCriada }: { podeCriar: boolean; onCriada: () => void }) {
  const anoAtual = new Date().getFullYear();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<PropostaListada['tipo']>('CONTRATO');
  const [nome, setNome] = useState('');
  const [dataInicio, setDataInicio] = useState(`${anoAtual}-01-01`);
  const [dataFim, setDataFim] = useState(`${anoAtual}-12-31`);
  const [categoria, setCategoria] = useState<PropostaListada['categoria']>('CONSOLIDADA');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!podeCriar) return null;

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
        Nova Proposta
      </button>
    );
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await cadastrarProposta({ tipo, nome, dataInicio, dataFim, categoria });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setAberto(false);
      setNome('');
      onCriada();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <h3 className="font-medium">Nova Proposta</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as PropostaListada['tipo'])} className="w-full rounded border px-2 py-1 text-sm">
            <option value="CONTRATO">Contrato</option>
            <option value="TERMO_DE_PARCERIA">Termo de Parceria</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as PropostaListada['categoria'])}
            className="w-full rounded border px-2 py-1 text-sm"
          >
            <option value="CONSOLIDADA">Consolidada</option>
            <option value="POR_META">Por Meta</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Nome</label>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Data Início</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Data Fim</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={pending || nome.trim().length === 0}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded border px-3 py-1.5 text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function LinhaProposta({
  proposta,
  podeDuplicar,
  podeExcluirVersao,
  onMudou,
}: {
  proposta: PropostaListada;
  podeDuplicar: boolean;
  podeExcluirVersao: boolean;
  onMudou: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function duplicar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await duplicarProposta(proposta.id);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      onMudou();
    });
  }

  function excluirVersao() {
    if (!proposta.versaoVigenteId) return;
    setErro(null);
    startTransition(async () => {
      const resposta = await excluirVersaoProposta(proposta.versaoVigenteId!);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      onMudou();
    });
  }

  return (
    <li className="px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gray-500">{proposta.codigo}</span>
          <Link href={`/propostas/${proposta.id}`} className="font-medium hover:underline">
            {proposta.nome}
          </Link>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">{LABEL_TIPO[proposta.tipo]}</span>
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">{proposta.status}</span>
          {proposta.versaoVigenteNumero !== null && (
            <span className="text-xs text-gray-500">v{proposta.versaoVigenteNumero}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {podeDuplicar && (
            <button type="button" onClick={duplicar} disabled={pending} className="rounded border px-2 py-1 text-xs disabled:opacity-50">
              Duplicar
            </button>
          )}
          {podeExcluirVersao && proposta.versaoVigenteId && (
            <button
              type="button"
              onClick={excluirVersao}
              disabled={pending}
              className="rounded border px-2 py-1 text-xs text-red-700 disabled:opacity-50"
            >
              Excluir Versão
            </button>
          )}
        </div>
      </div>
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
    </li>
  );
}

/** US-114 — Lista de Propostas + ações de Cadastrar/Duplicar/Excluir Versão. */
export function PropostaListPanel({
  propostasIniciais,
  podeCriar,
  podeDuplicar,
  podeExcluirVersao,
}: {
  propostasIniciais: PropostaListada[];
  podeCriar: boolean;
  podeDuplicar: boolean;
  podeExcluirVersao: boolean;
}) {
  const [propostas, setPropostas] = useState(propostasIniciais);
  const [, startTransition] = useTransition();

  function recarregar() {
    startTransition(async () => {
      const { listarPropostas } = await import('./actions');
      const resposta = await listarPropostas();
      if (resposta.sucesso) setPropostas(resposta.dados);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <NovaPropostaForm podeCriar={podeCriar} onCriada={recarregar} />

      {propostas.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma Proposta cadastrada ainda.</p>
      ) : (
        <ul className="divide-y rounded border">
          {propostas.map((proposta) => (
            <LinhaProposta
              key={proposta.id}
              proposta={proposta}
              podeDuplicar={podeDuplicar}
              podeExcluirVersao={podeExcluirVersao}
              onMudou={recarregar}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
