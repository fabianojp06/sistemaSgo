'use client';

import { useState, useTransition } from 'react';
import { editarCalendarioRepasseProposta } from './actions';

const PARCELAS_OPCOES = [1, 2, 3, 4, 6, 12];
const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * US-142/ADR-049 — mini-form do calendário de repasse na capa da Proposta.
 * Só interativo quando `editavel` (Versão vigente em RASCUNHO/EM_ELABORACAO);
 * caso contrário exibe os valores em modo leitura.
 */
export function CalendarioRepassePropostaMiniForm({
  propostaId,
  parcelasPorAno,
  mesInicialRepasse,
  editavel,
}: {
  propostaId: string;
  parcelasPorAno: number | null;
  mesInicialRepasse: number | null;
  editavel: boolean;
}) {
  const [ppa, setPpa] = useState<string>(parcelasPorAno != null ? String(parcelasPorAno) : '');
  const [mir, setMir] = useState<string>(mesInicialRepasse != null ? String(mesInicialRepasse) : '');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const salvarDesabilitado =
    pending ||
    (String(parcelasPorAno ?? '') === ppa && String(mesInicialRepasse ?? '') === mir) ||
    (ppa === '') !== (mir === '');

  function salvar() {
    setMsg(null);
    startTransition(async () => {
      const r = await editarCalendarioRepasseProposta({
        propostaId,
        parcelasPorAno: ppa === '' ? null : Number(ppa),
        mesInicialRepasse: mir === '' ? null : Number(mir),
      });
      setMsg(r.sucesso ? { tipo: 'ok', texto: 'Calendário atualizado.' } : { tipo: 'erro', texto: r.mensagem });
    });
  }

  if (!editavel) {
    const texto =
      parcelasPorAno != null && mesInicialRepasse != null
        ? `${parcelasPorAno} parcela(s)/ano a partir de ${MESES[mesInicialRepasse - 1]}`
        : 'não configurado (padrão: 3 parcelas/ano a partir de Janeiro)';
    return (
      <p className="mt-2 text-xs text-gray-500">
        <span className="text-gray-400">Calendário de repasse:</span> {texto}
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-white p-3 text-sm shadow-sm dark:border-[#2B303C] dark:bg-[#191D26]">
      <span className="w-full text-xs font-medium text-gray-500">Calendário de repasse (Cronograma de Desembolso)</span>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Parcelas por ano</span>
        <select
          value={ppa}
          onChange={(e) => setPpa(e.target.value)}
          className="rounded-[6px] border border-gray-200 bg-white px-2 py-1 text-xs dark:border-[#2B303C] dark:bg-[#12151C]"
        >
          <option value="">— (padrão: 3)</option>
          {PARCELAS_OPCOES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Mês inicial do repasse</span>
        <select
          value={mir}
          onChange={(e) => setMir(e.target.value)}
          className="rounded-[6px] border border-gray-200 bg-white px-2 py-1 text-xs dark:border-[#2B303C] dark:bg-[#12151C]"
        >
          <option value="">— (padrão: Janeiro)</option>
          {MESES.map((nome, i) => (
            <option key={nome} value={i + 1}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={salvar}
        disabled={salvarDesabilitado}
        className="rounded-[6px] bg-[#2B5FD9] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-50 dark:bg-[#6D93F0] dark:text-[#12151C]"
      >
        {pending ? 'Salvando...' : 'Salvar'}
      </button>
      {msg && (
        <span className={`text-xs ${msg.tipo === 'ok' ? 'text-green-600' : 'text-[#C43D3D] dark:text-[#E0716B]'}`}>
          {msg.texto}
        </span>
      )}
    </div>
  );
}
