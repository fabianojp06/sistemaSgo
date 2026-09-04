'use client';

import { useState, useTransition } from 'react';
import {
  configurarRateioImposto,
  gerarImpostosDaVersao,
  type GerarImpostosResultado,
  type RateioImpostoResultado,
} from './actions';
import { SeletorContaAnalitica } from '@/app/(autenticado)/propostas/SeletorContaAnalitica';

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
  readOnly,
  gerarImpostosHabilitado = false,
  avisoStale = false,
}: {
  versaoId: string;
  contasAnaliticas: ContaOpcao[];
  aliquotas: AliquotaOpcao[];
  readOnly?: boolean;
  /** US-144 — habilita "Gerar Impostos da Versão" (há ao menos um tributo vinculado). */
  gerarImpostosHabilitado?: boolean;
  /** US-144 RN_TAX_13 — fontes de custo mudaram desde o último cálculo de impostos. */
  avisoStale?: boolean;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [aliquotaParametroId, setAliquotaParametroId] = useState(aliquotas[0]?.id ?? '');
  const [contaId, setContaId] = useState(contasAnaliticas[0]?.id ?? '');
  const [competencia, setCompetencia] = useState(hoje);
  const [valorDeclarado, setValorDeclarado] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<RateioImpostoResultado | null>(null);
  const [pending, startTransition] = useTransition();

  const [gerando, startGeracao] = useTransition();
  const [erroGeracao, setErroGeracao] = useState<string | null>(null);
  const [resultadoGeracao, setResultadoGeracao] = useState<GerarImpostosResultado | null>(null);

  function gerarImpostos() {
    setErroGeracao(null);
    setResultadoGeracao(null);
    startGeracao(async () => {
      const resposta = await gerarImpostosDaVersao({ versaoId });
      if (!resposta.sucesso) {
        setErroGeracao(resposta.mensagem);
        return;
      }
      setResultadoGeracao(resposta.dados);
    });
  }

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

      {/* US-144 — motor de cálculo automático de imposto (base × alíquota%). */}
      {!readOnly && (
        <div className="flex flex-col gap-2 rounded bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-800">Gerar Impostos da Versão</p>
              <p className="text-xs text-slate-500">
                Calcula automaticamente <code>imposto = custo bruto da conta × alíquota%</code> para cada tributo
                vinculado. Substitui apenas as linhas calculadas anteriormente — linhas digitadas à mão não são
                tocadas.
              </p>
            </div>
            <button
              type="button"
              onClick={gerarImpostos}
              disabled={gerando || !gerarImpostosHabilitado}
              className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {gerando ? 'Gerando...' : 'Gerar Impostos da Versão'}
            </button>
          </div>

          {!gerarImpostosHabilitado && (
            <p className="text-xs text-slate-500">
              Cadastre custos e vincule ao menos um tributo antes de gerar impostos.
            </p>
          )}
          {avisoStale && (
            <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Os custos desta Versão mudaram desde o último cálculo de impostos. Clique em Gerar Impostos para
              atualizar.
            </p>
          )}
          {erroGeracao && <p className="text-xs text-red-600">{erroGeracao}</p>}
          {resultadoGeracao && (
            <p className="rounded bg-green-50 px-2 py-1 text-xs text-green-800">
              Impostos gerados: {resultadoGeracao.linhasGeradas} linha(s), R$ {resultadoGeracao.valorTotalImposto}
              {resultadoGeracao.paresPuladosPorBaseZero > 0 &&
                ` — ${resultadoGeracao.paresPuladosPorBaseZero} par(es) sem custo ignorado(s)`}
              {resultadoGeracao.paresPuladosPorDeclarado > 0 &&
                ` — ${resultadoGeracao.paresPuladosPorDeclarado} par(es) com linha manual preservada(s)`}
              . Recarregue a página para ver os valores atualizados.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tributo</label>
          <select
            value={aliquotaParametroId}
            onChange={(e) => setAliquotaParametroId(e.target.value)}
            disabled={readOnly}
            className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50"
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
          <SeletorContaAnalitica contas={contasAnaliticas} value={contaId} onChange={setContaId} disabled={readOnly} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Competência</label>
          <input
            type="date"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            disabled={readOnly}
            className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50"
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
            disabled={readOnly}
            className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50"
          />
        </div>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {resultado && (
        <div className="rounded bg-green-50 p-2 text-xs text-green-800">
          Rateio configurado: R$ {resultado.valorDeclarado} (alíquota aplicada {resultado.aliquotaAplicadaSnapshot}%)
        </div>
      )}

      {!readOnly && (
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
      )}
    </div>
  );
}
