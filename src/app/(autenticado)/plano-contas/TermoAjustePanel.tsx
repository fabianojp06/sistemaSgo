'use client';

import { useState, useTransition } from 'react';
import {
  solicitarTermoAjuste,
  aprovarTermoAjusteN1,
  homologarTermoAjuste,
  rejeitarTermoAjuste,
  listarTermosAjuste,
  type TermoAjusteListadoResultado,
} from './actions';

type ContaOpcao = { id: string; label: string };

const STATUS_LABEL: Record<string, string> = {
  PENDENTE_APROVACAO_N1: 'Aguardando aprovação (1º nível)',
  PENDENTE_APROVACAO_GESTOR_MASTER: 'Aguardando homologação (Gestor Master)',
  HOMOLOGADO: 'Homologado',
  REJEITADO: 'Rejeitado',
};

const STATUS_COR: Record<string, string> = {
  PENDENTE_APROVACAO_N1: 'bg-amber-50 text-amber-800',
  PENDENTE_APROVACAO_GESTOR_MASTER: 'bg-amber-50 text-amber-800',
  HOMOLOGADO: 'bg-green-50 text-green-800',
  REJEITADO: 'bg-red-50 text-red-800',
};

/**
 * US-111 (UC03.13, ADR-025) — Solicitar e conduzir a aprovação em 2 etapas (N1 →
 * Gestor Master) do Termo de Ajuste entre contas analíticas da mesma Versão de
 * Proposta. `podeAprovarN1`/`podeHomologarGestorMaster` vêm do servidor (checagem
 * de PerfilFuncionalidade) — os botões de ação só aparecem para quem tem permissão.
 */
export function TermoAjustePanel({
  versaoId,
  contasAnaliticas,
  termosIniciais,
  podeAprovarN1,
  podeHomologarGestorMaster,
}: {
  versaoId: string;
  contasAnaliticas: ContaOpcao[];
  termosIniciais: TermoAjusteListadoResultado[];
  podeAprovarN1: boolean;
  podeHomologarGestorMaster: boolean;
}) {
  const anoAtual = new Date().getFullYear();
  const [contaOrigemId, setContaOrigemId] = useState(contasAnaliticas[0]?.id ?? '');
  const [contaDestinoId, setContaDestinoId] = useState(contasAnaliticas[1]?.id ?? contasAnaliticas[0]?.id ?? '');
  const [exercicio, setExercicio] = useState(anoAtual);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [termos, setTermos] = useState<TermoAjusteListadoResultado[]>(termosIniciais);
  const [pending, startTransition] = useTransition();
  const [acaoEmAndamentoId, setAcaoEmAndamentoId] = useState<string | null>(null);

  function atualizarLista() {
    startTransition(async () => {
      const resposta = await listarTermosAjuste(versaoId);
      if (resposta.sucesso) setTermos(resposta.dados);
    });
  }

  function solicitar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await solicitarTermoAjuste({ versaoId, contaOrigemId, contaDestinoId, exercicio, valor });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setValor('');
      atualizarLista();
    });
  }

  function executarAcao(id: string, acao: (id: string) => Promise<{ sucesso: boolean; mensagem?: string }>) {
    setErro(null);
    setAcaoEmAndamentoId(id);
    startTransition(async () => {
      const resposta = await acao(id);
      setAcaoEmAndamentoId(null);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem ?? 'Erro desconhecido.');
        return;
      }
      atualizarLista();
    });
  }

  if (contasAnaliticas.length < 2) {
    return <p className="text-sm text-gray-500">São necessárias ao menos 2 contas analíticas para criar um Termo de Ajuste.</p>;
  }

  return (
    <div className="flex flex-col gap-4 rounded border p-4">
      <h3 className="font-medium">Termo de Ajuste entre Contas Analíticas</h3>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Conta de Origem</label>
          <select value={contaOrigemId} onChange={(e) => setContaOrigemId(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
            {contasAnaliticas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Conta de Destino</label>
          <select value={contaDestinoId} onChange={(e) => setContaDestinoId(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
            {contasAnaliticas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Exercício</label>
          <input
            type="number"
            value={exercicio}
            onChange={(e) => setExercicio(Number(e.target.value))}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Valor (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </div>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div>
        <button
          type="button"
          onClick={solicitar}
          disabled={pending || valor.trim().length === 0 || contaOrigemId === contaDestinoId}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending && acaoEmAndamentoId === null ? 'Solicitando...' : 'Solicitar Ajuste'}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-medium text-gray-500">Termos de Ajuste desta Versão</h4>
        {termos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum Termo de Ajuste solicitado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {termos.map((termo) => (
              <li key={termo.id} className="flex flex-col gap-1 rounded border p-2 text-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <p>
                    R$ {termo.valor} — {termo.contaOrigemLabel} → {termo.contaDestinoLabel} (exercício {termo.exercicio})
                  </p>
                  <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_COR[termo.status] ?? 'bg-gray-50 text-gray-800'}`}>
                    {STATUS_LABEL[termo.status] ?? termo.status}
                  </span>
                </div>

                <div className="flex gap-2">
                  {termo.status === 'PENDENTE_APROVACAO_N1' && podeAprovarN1 && (
                    <button
                      type="button"
                      onClick={() => executarAcao(termo.id, (id) => aprovarTermoAjusteN1(id))}
                      disabled={pending}
                      className="rounded bg-green-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      Aprovar (1º nível)
                    </button>
                  )}
                  {termo.status === 'PENDENTE_APROVACAO_GESTOR_MASTER' && podeHomologarGestorMaster && (
                    <button
                      type="button"
                      onClick={() => executarAcao(termo.id, (id) => homologarTermoAjuste(id))}
                      disabled={pending}
                      className="rounded bg-green-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      Homologar (Gestor Master)
                    </button>
                  )}
                  {(termo.status === 'PENDENTE_APROVACAO_N1' || termo.status === 'PENDENTE_APROVACAO_GESTOR_MASTER') &&
                    (podeAprovarN1 || podeHomologarGestorMaster) && (
                      <button
                        type="button"
                        onClick={() => executarAcao(termo.id, (id) => rejeitarTermoAjuste(id))}
                        disabled={pending}
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >
                        Rejeitar
                      </button>
                    )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
