'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { cadastrarViagem, excluirViagem, type ViagemResultado } from '@/app/plano-contas/actions';
import { SeletorContaAnalitica } from './SeletorContaAnalitica';
import { BarChartHorizontal } from './BarChartHorizontal';
import { calcularComponentesCustoViagem } from '@/domain/plano-contas/calcularCustoEstimadoViagem';

type ContaOpcao = { id: string; label: string };

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: number | string): string {
  return formatadorMoeda.format(Number(valor));
}

// Mesmos ícones minimalistas inline de EmpregadoPanel.tsx — sem lib de ícones.
function IconeMala() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconeMoeda() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5c0-1.4 1.34-2.5 3-2.5s3 1.1 3 2.5-1.34 2-3 2-3 .6-3 2 1.34 2.5 3 2.5 3-1.1 3-2.5" strokeLinecap="round" />
    </svg>
  );
}
function IconePessoas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconeMedia() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path d="M4 19V9M12 19V5M20 19v-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 19h20" strokeLinecap="round" />
    </svg>
  );
}

// Paleta categórica validada pela skill dataviz — mesmo ciclo de 8 hues usado em EmpregadoPanel.tsx/ValorOrcado.
const PALETA_CATEGORICA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

/** ADR-036 — Faixa executiva com os KPIs da tela de Viagens, mesmo padrão de EmpregadoPanel.tsx. */
function ResumoExecutivoViagens({ totalViagens, custoTotalEstimado, totalPessoas }: { totalViagens: number; custoTotalEstimado: number; totalPessoas: number }) {
  const custoMedioPorViagem = totalViagens > 0 ? custoTotalEstimado / totalViagens : 0;
  const kpis = [
    { icone: <IconeMala />, label: 'Nº de Viagens', valor: String(totalViagens) },
    { icone: <IconeMoeda />, label: 'Custo Total Estimado', valor: formatarMoeda(custoTotalEstimado) },
    { icone: <IconeMedia />, label: 'Custo Médio por Viagem', valor: formatarMoeda(custoMedioPorViagem) },
    { icone: <IconePessoas />, label: 'Total de Pessoas-Viagem', valor: String(totalPessoas) },
  ];

  return (
    <div className="rounded-xl bg-slate-900 p-5 shadow-md md:p-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-400">{kpi.icone}</span>
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400">{kpi.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{kpi.valor}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type ValoresFormulario = {
  descricao: string;
  quantidadePessoas: number;
  mediaDias: number;
  custoUnitarioPassagem: number;
  contaPassagemId: string;
  custoUnitarioDiaria: number;
  contaDiariaId: string;
  custoUnitarioTransporte: number;
  contaTransporteId: string;
};

function NovaViagemForm({
  versaoId,
  contasAnaliticas,
  readOnly,
  valoresIniciais,
  onCriada,
}: {
  versaoId: string;
  contasAnaliticas: ContaOpcao[];
  readOnly?: boolean;
  valoresIniciais: ValoresFormulario;
  onCriada: (resultado: ViagemResultado) => void;
}) {
  const [descricao, setDescricao] = useState(valoresIniciais.descricao);
  const [quantidadePessoas, setQuantidadePessoas] = useState(valoresIniciais.quantidadePessoas);
  const [mediaDias, setMediaDias] = useState(valoresIniciais.mediaDias);
  const [custoUnitarioPassagem, setCustoUnitarioPassagem] = useState(valoresIniciais.custoUnitarioPassagem);
  const [contaPassagemId, setContaPassagemId] = useState(valoresIniciais.contaPassagemId || contasAnaliticas[0]?.id || '');
  const [custoUnitarioDiaria, setCustoUnitarioDiaria] = useState(valoresIniciais.custoUnitarioDiaria);
  const [contaDiariaId, setContaDiariaId] = useState(valoresIniciais.contaDiariaId || contasAnaliticas[0]?.id || '');
  const [custoUnitarioTransporte, setCustoUnitarioTransporte] = useState(valoresIniciais.custoUnitarioTransporte);
  const [contaTransporteId, setContaTransporteId] = useState(valoresIniciais.contaTransporteId || contasAnaliticas[0]?.id || '');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (readOnly) return null;
  if (contasAnaliticas.length === 0) return <p className="text-sm text-slate-500">Nenhuma conta analítica disponível.</p>;

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
    <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm md:p-5">
      <h4 className="text-sm font-semibold text-slate-800">Nova Viagem</h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">Descrição</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={100}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Quantidade de Pessoas</label>
          <input
            type="number"
            min={1}
            value={quantidadePessoas}
            onChange={(e) => setQuantidadePessoas(Number(e.target.value))}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Média de Dias</label>
          <input
            type="number"
            min={1}
            value={mediaDias}
            onChange={(e) => setMediaDias(Number(e.target.value))}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Custo Unit. Passagem</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={custoUnitarioPassagem}
            onChange={(e) => setCustoUnitarioPassagem(Number(e.target.value))}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Conta — Passagem</label>
          <SeletorContaAnalitica contas={contasAnaliticas} value={contaPassagemId} onChange={setContaPassagemId} />
        </div>
        <div />

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Custo Unit. Diária</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={custoUnitarioDiaria}
            onChange={(e) => setCustoUnitarioDiaria(Number(e.target.value))}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Conta — Diária</label>
          <SeletorContaAnalitica contas={contasAnaliticas} value={contaDiariaId} onChange={setContaDiariaId} />
        </div>
        <div />

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Custo Unit. Transporte</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={custoUnitarioTransporte}
            onChange={(e) => setCustoUnitarioTransporte(Number(e.target.value))}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Conta — Transporte</label>
          <SeletorContaAnalitica contas={contasAnaliticas} value={contaTransporteId} onChange={setContaTransporteId} />
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

const VALORES_VAZIOS: ValoresFormulario = {
  descricao: '',
  quantidadePessoas: 1,
  mediaDias: 1,
  custoUnitarioPassagem: 0,
  contaPassagemId: '',
  custoUnitarioDiaria: 0,
  contaDiariaId: '',
  custoUnitarioTransporte: 0,
  contaTransporteId: '',
};

/** US-109/US-115 — Viagens (POR_META ou CONSOLIDADA; Meta só é exigida pelo use case quando POR_META).
 * Redesign visual desta sessão: mesma linguagem de EmpregadoPanel.tsx (cards com sombra leve,
 * bordas suaves, slate-* para hierarquia neutra). Botão "Copiar" pré-preenche o formulário
 * (`chaveFormulario` força o React a remontar o form com os novos valores iniciais) com os
 * dados da Viagem clicada, sem nova Server Action — reaproveita `cadastrarViagem` já existente,
 * é só um atalho de preenchimento para agilizar cadastro repetitivo. */
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
  const [valoresFormulario, setValoresFormulario] = useState<ValoresFormulario>(VALORES_VAZIOS);
  const [chaveFormulario, setChaveFormulario] = useState(0);
  const formularioRef = useRef<HTMLDivElement>(null);

  function excluir(viagemId: string) {
    startTransition(async () => {
      const resposta = await excluirViagem(viagemId);
      if (resposta.sucesso) setViagens((atual) => atual.filter((v) => v.id !== viagemId));
    });
  }

  // ADR-036 — dashboard deriva do state `viagens` já existente (useMemo), recalcula sozinho
  // ao criar/copiar/excluir Viagem, sem código de sincronização adicional.
  const totalPessoas = useMemo(() => viagens.reduce((soma, v) => soma + v.quantidadePessoas, 0), [viagens]);
  const custoTotalEstimado = useMemo(() => viagens.reduce((soma, v) => soma + Number(v.custoEstimado), 0), [viagens]);

  const rankingPorViagem = useMemo(
    () =>
      viagens.map((v, i) => ({
        id: v.id,
        label: v.descricao,
        valor: Number(v.custoEstimado),
        cor: PALETA_CATEGORICA[i % PALETA_CATEGORICA.length],
      })),
    [viagens],
  );

  const composicaoPorComponente = useMemo(() => {
    const totais = viagens.reduce(
      (acc, v) => {
        const componentes = calcularComponentesCustoViagem({
          quantidadePessoas: v.quantidadePessoas,
          mediaDias: v.mediaDias,
          custoUnitarioPassagem: v.custoUnitarioPassagem,
          custoUnitarioDiaria: v.custoUnitarioDiaria,
          custoUnitarioTransporte: v.custoUnitarioTransporte,
        });
        return {
          passagem: acc.passagem + componentes.passagem.toNumber(),
          diaria: acc.diaria + componentes.diaria.toNumber(),
          transporte: acc.transporte + componentes.transporte.toNumber(),
        };
      },
      { passagem: 0, diaria: 0, transporte: 0 },
    );

    return [
      { id: 'passagem', label: 'Passagem', valor: totais.passagem, cor: PALETA_CATEGORICA[0] },
      { id: 'diaria', label: 'Diária', valor: totais.diaria, cor: PALETA_CATEGORICA[1] },
      { id: 'transporte', label: 'Transporte', valor: totais.transporte, cor: PALETA_CATEGORICA[2] },
    ];
  }, [viagens]);

  function copiar(viagem: ViagemResultado) {
    setValoresFormulario({
      descricao: `${viagem.descricao} (cópia)`,
      quantidadePessoas: viagem.quantidadePessoas,
      mediaDias: viagem.mediaDias,
      custoUnitarioPassagem: Number(viagem.custoUnitarioPassagem),
      contaPassagemId: viagem.contaPassagemId,
      custoUnitarioDiaria: Number(viagem.custoUnitarioDiaria),
      contaDiariaId: viagem.contaDiariaId,
      custoUnitarioTransporte: Number(viagem.custoUnitarioTransporte),
      contaTransporteId: viagem.contaTransporteId,
    });
    setChaveFormulario((k) => k + 1);
    formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4 md:p-6">
      <h3 className="font-semibold text-slate-800">Viagens</h3>

      {viagens.length > 0 && (
        <>
          <ResumoExecutivoViagens totalViagens={viagens.length} custoTotalEstimado={custoTotalEstimado} totalPessoas={totalPessoas} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BarChartHorizontal titulo="Ranking de Viagens — Custo Estimado" barras={rankingPorViagem} formatarValor={formatarMoeda} />
            <BarChartHorizontal titulo="Composição de Custo — Passagem × Diária × Transporte" barras={composicaoPorComponente} formatarValor={formatarMoeda} />
          </div>
        </>
      )}

      <div ref={formularioRef}>
        <NovaViagemForm
          key={chaveFormulario}
          versaoId={versaoId}
          contasAnaliticas={contasAnaliticas}
          readOnly={readOnly}
          valoresIniciais={valoresFormulario}
          onCriada={(v) => {
            setViagens((atual) => [...atual, v]);
            setValoresFormulario(VALORES_VAZIOS);
            setChaveFormulario((k) => k + 1);
          }}
        />
      </div>
      {viagens.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma Viagem cadastrada.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {viagens.map((viagem) => (
            <li
              key={viagem.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-sm shadow-sm"
            >
              <span>
                {viagem.descricao} — <span className="text-xs text-slate-500">custo estimado R$ {viagem.custoEstimado}</span>
              </span>
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copiar(viagem)}
                    disabled={pending}
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={() => excluir(viagem.id)}
                    disabled={pending}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
