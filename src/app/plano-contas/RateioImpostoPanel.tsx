'use client';

import { useState, useTransition } from 'react';
import { configurarRateioImposto, type RateioImpostoResultado } from './actions';

type ContaOpcao = { id: string; label: string };
type AliquotaOpcao = { id: string; label: string };

/**
 * US-101/US-101a — Parametrizar Impostos em Proposta (Rateio de Impostos por
 * conta analítica, ADR-027). Interação mínima (uma competência por vez),
 * mesmo padrão de ValorOrcadoContaForm.
 */
export function RateioImpostoPanel({
  versaoId,
  contasAnaliticas,
  aliquotas,
}: {
  versaoId: string;
  contasAnaliticas: ContaOpcao[];
  aliquotas: AliquotaOpcao[];
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [aliquotaParametroId, setAliquotaParametroId] = useState(aliquotas[0]?.id ?? '');
  const [contaId, setContaId] = useState(contasAnaliticas[0]?.id ?? '');
  const [competencia, setCompetencia] = useState(hoje);
  const [valorDeclarado, setValorDeclarado] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<RateioImpostoResultado | null>(null);
  const [pending, startTransition] = useTransition();

  function salvar() {
    setErro(null);
    setResultado(null);
    startTransition(async () => {
      const resposta = await configurarRateioImposto({
        versaoId,
        aliquotaParametroId,
        contaId,
        competencia,
        valorDeclarado,
      });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setResultado(resposta.dados);
    });
  }

  if (aliquotas.length === 0) {
    return <p className="text-sm text-gray-500">Nenhum imposto parametrizado neste tenant ainda.</p>;
  }
  if (contasAnaliticas.length === 0) {
    return <p className="text-sm text-gray-500">Nenhuma conta analítica disponível para o rateio.</p>;
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <h3 className="font-medium">Rateio de Impostos</h3>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tributo</label>
          <select
            value={aliquotaParametroId}
            onChange={(e) => setAliquotaParametroId(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          >
            {aliquotas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Conta Analítica</label>
          <select value={contaId} onChange={(e) => setContaId(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
            {contasAnaliticas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Competência</label>
          <input
            type="date"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Valor Declarado (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            value={valorDeclarado}
            onChange={(e) => setValorDeclarado(e.target.value)}
            placeholder="0,00"
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </div>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {resultado && (
        <div className="rounded bg-green-50 p-2 text-xs text-green-800">
          Rateio configurado: R$ {resultado.valorDeclarado} (alíquota aplicada {resultado.aliquotaAplicadaSnapshot}%)
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={salvar}
          disabled={pending || valorDeclarado.trim().length === 0}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
