'use client';

import { useState, useTransition } from 'react';
import { configurarValorOrcadoConta, type ValorOrcadoContaResultado } from './actions';

type ContaOpcao = { id: string; label: string };

/**
 * US-007 — Configurar Valor Orçado por Conta Analítica e Exercício.
 * Interação mínima (uma conta por vez): não é a grade completa da Central de
 * Cálculos (US-101/UC03.01), que fica para quando essa frente for implementada.
 */
export function ValorOrcadoContaForm({ versaoId, contasAnaliticas }: { versaoId: string; contasAnaliticas: ContaOpcao[] }) {
  const anoAtual = new Date().getFullYear();
  const [contaId, setContaId] = useState(contasAnaliticas[0]?.id ?? '');
  const [exercicio, setExercicio] = useState(anoAtual);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ValorOrcadoContaResultado | null>(null);
  const [pending, startTransition] = useTransition();

  function salvar() {
    setErro(null);
    setResultado(null);
    startTransition(async () => {
      const resposta = await configurarValorOrcadoConta(versaoId, contaId, exercicio, valor);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setResultado(resposta.dados);
    });
  }

  if (contasAnaliticas.length === 0) {
    return <p className="text-sm text-gray-500">Nenhuma conta analítica disponível para configuração de valor.</p>;
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <h3 className="font-medium">Configurar Valor Orçado</h3>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Conta Analítica</label>
          <select
            value={contaId}
            onChange={(e) => setContaId(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          >
            {contasAnaliticas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.label}
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

      {resultado && (
        <div className="rounded bg-green-50 p-2 text-xs text-green-800">
          <p>
            Valor configurado: R$ {resultado.valor} (exercício {resultado.exercicio})
          </p>
          {resultado.totaisAncestrais.length > 0 && (
            <p className="mt-1">
              Totais atualizados nas contas ancestrais: {resultado.totaisAncestrais.length} conta(s) recalculada(s).
            </p>
          )}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={salvar}
          disabled={pending || valor.trim().length === 0}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
