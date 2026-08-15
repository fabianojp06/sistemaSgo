'use client';

import { Fragment, useState, useTransition } from 'react';
import {
  salvarCargoCompleto,
  ressincronizarSnapshotEmpregadosCargo,
  excluirCargo,
  excluirCargosEmLote,
  type CargoResultado,
  type UnidadeFuncionalResultado,
} from './estrutura-actions';
import { TabelaSalarialModal } from './TabelaSalarialModal';
import { ImportarCargoRubiModal } from './ImportarCargoRubiModal';
import { SeletorContaAnalitica } from './SeletorContaAnalitica';

export type CargoComVinculo = CargoResultado;

const FONTES = [
  { value: 'MERCADO_MINIMO', label: 'Mercado Mínimo' },
  { value: 'MERCADO_MAXIMO', label: 'Mercado Máximo' },
  { value: 'RUBI', label: 'Rubi (Salário Real)' },
] as const;

const BENEFICIOS_SIMPLES = [
  { ativo: 'vaAtivo', valor: 'vaValorUnitario', conta: 'contaValeAlimentacaoId', label: 'Vale Alimentação' },
  { ativo: 'vrAtivo', valor: 'vrValorUnitario', conta: 'contaValeRefeicaoId', label: 'Vale Refeição' },
  { ativo: 'planoOdontoAtivo', valor: 'planoOdontoValor', conta: 'contaPlanoOdontologicoId', label: 'Plano Odontológico' },
  { ativo: 'seguroVidaAtivo', valor: 'seguroVidaValor', conta: 'contaSeguroVidaId', label: 'Seguro de Vida' },
  { ativo: 'auxilioCrecheAtivo', valor: 'auxilioCrecheValor', conta: 'contaAuxilioCrecheId', label: 'Auxílio Creche' },
  { ativo: 'transporteAtivo', valor: 'transporteValorUnitario', conta: 'contaValeTransporteId', label: 'Vale Transporte' },
] as const;

// ADR-044 — US-136: Periculosidade e Insalubridade, cada um com escolha única de
// tipo (Percentual sobre salarioTotal ou Valor Fixo em R$), nunca os dois ao mesmo tempo.
const ADICIONAIS = [
  { ativo: 'periculosidadeAtivo', tipo: 'periculosidadeTipo', valor: 'periculosidadeValor', conta: 'contaPericulosidadeId', label: 'Periculosidade' },
  { ativo: 'insalubridadeAtivo', tipo: 'insalubridadeTipo', valor: 'insalubridadeValor', conta: 'contaInsalubridadeId', label: 'Insalubridade' },
] as const;

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: number | string): string {
  return formatadorMoeda.format(Number(valor));
}

// Mesmos ícones minimalistas inline do EmpregadoPanel — sem dependência de biblioteca de ícones.
function IconeCracha() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M8 17c0-1.8 1.8-3 4-3s4 1.2 4 3M9 4V2.5M15 4V2.5" strokeLinecap="round" />
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
function IconeGrafico() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Faixa executiva (mesmo padrão do EmpregadoPanel) com os KPIs principais da tela de Cargos. */
function ResumoExecutivo({ totalCargos, custoTotalMensal, salarioTotalMensal }: { totalCargos: number; custoTotalMensal: number; salarioTotalMensal: number }) {
  const kpis = [
    { icone: <IconeCracha />, label: 'Total de Cargos', valor: String(totalCargos) },
    { icone: <IconeMoeda />, label: 'Custo Total Mensal', valor: `${formatarMoeda(custoTotalMensal)}/mês` },
    { icone: <IconeGrafico />, label: 'Salário Total Mensal', valor: `${formatarMoeda(salarioTotalMensal)}/mês` },
  ];

  return (
    <div className="rounded-xl bg-slate-900 p-5 shadow-md md:p-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-4">
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

/** ADR-029 — seletor de conta analítica de um componente de custo, reaproveitado em todos os campos. */
function ContaComponenteSelect({
  contasAnaliticas,
  value,
  onChange,
  disabled,
}: {
  contasAnaliticas: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded border px-2 py-1 text-xs text-gray-600 disabled:opacity-50"
    >
      <option value="">Conta...</option>
      {contasAnaliticas.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

function dadosVazios() {
  return {
    nomeCargoMercado: '',
    unidadeFuncionalId: '',
    contaId: '',
    fonteAtiva: 'MERCADO_MINIMO' as (typeof FONTES)[number]['value'],
    salarioMercadoMinimo: '',
    salarioMercadoMaximo: '',
    origemSalarioMinimo: 'MANUAL' as 'TABELA_SALARIAL' | 'MANUAL',
    origemSalarioMaximo: 'MANUAL' as 'TABELA_SALARIAL' | 'MANUAL',
    funcaoGratificada: '',
    contaGratificacaoId: '',
    periodoInicio: '',
    encargosSociaisPct: '0',
    contaEncargosSociaisId: '',
    vaAtivo: false,
    vaValorUnitario: '0',
    contaValeAlimentacaoId: '',
    vrAtivo: false,
    vrValorUnitario: '0',
    contaValeRefeicaoId: '',
    planoSaudeAtivo: false,
    planoSaudeFaixa: null as 'BASICO' | 'INTERMEDIARIO' | 'EXECUTIVO' | null,
    planoSaudeValor: '0',
    contaPlanoSaudeId: '',
    planoOdontoAtivo: false,
    planoOdontoValor: '0',
    contaPlanoOdontologicoId: '',
    seguroVidaAtivo: false,
    seguroVidaValor: '0',
    contaSeguroVidaId: '',
    auxilioCrecheAtivo: false,
    auxilioCrecheValor: '0',
    contaAuxilioCrecheId: '',
    transporteAtivo: false,
    transporteValorUnitario: '0',
    contaValeTransporteId: '',
    periculosidadeAtivo: false,
    periculosidadeTipo: null as 'PERCENTUAL' | 'VALOR_FIXO' | null,
    periculosidadeValor: '0',
    contaPericulosidadeId: '',
    insalubridadeAtivo: false,
    insalubridadeTipo: null as 'PERCENTUAL' | 'VALOR_FIXO' | null,
    insalubridadeValor: '0',
    contaInsalubridadeId: '',
  };
}

/**
 * US-117 (UC03.19, blocos A/B/C) — Gerenciar Cargos: dados de mercado, conta,
 * rateio funcional e benefícios/encargos, tudo sob um único "Salvar Cargo"
 * (ADR-028 — orquestrado por salvarCargoCompleto, que por baixo ainda chama
 * os use cases de domínio separados de Cargo e de Benefícios). Layout
 * (faixa de KPIs + cards brancos sobre fundo slate) espelha o EmpregadoPanel.
 */
export function CargoPanel({
  propostaId,
  unidadesAnaliticas,
  contasAnaliticas,
  cargosIniciais,
  readOnly,
}: {
  propostaId: string;
  unidadesAnaliticas: UnidadeFuncionalResultado[];
  contasAnaliticas: { id: string; label: string }[];
  cargosIniciais: CargoComVinculo[];
  readOnly?: boolean;
}) {
  const [cargos, setCargos] = useState(cargosIniciais);
  const [cargoEmEdicaoId, setCargoEmEdicaoId] = useState<string | null>(null);
  const [tabelaSalarialAberta, setTabelaSalarialAberta] = useState(false);
  const [rubiModalAberta, setRubiModalAberta] = useState(false);
  const [dados, setDados] = useState(dadosVazios());
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ressincronizando, setRessincronizando] = useState(false);
  const [mensagemRessincronizacao, setMensagemRessincronizacao] = useState<string | null>(null);
  // Ressincronização por linha da lista (fora do modo de edição) — mesmo use case, gatilho mais visível.
  const [ressincronizandoLinhaId, setRessincronizandoLinhaId] = useState<string | null>(null);
  const [mensagemRessincronizacaoLinha, setMensagemRessincronizacaoLinha] = useState<{ cargoId: string; texto: string } | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const custoTotalMensal = cargos.reduce((soma, c) => soma + Number(c.custoTotalCargo), 0);
  const salarioTotalMensal = cargos.reduce((soma, c) => soma + Number(c.salarioTotal), 0);

  // ADR-045 (US-132) — origem da verdade dos 5 campos [ORIGEM BLINDADA] é a lista `cargos`
  // (espelha o que está persistido), não `dados` — eles nunca são editáveis no formulário.
  const cargoEmEdicao = cargoEmEdicaoId ? (cargos.find((c) => c.id === cargoEmEdicaoId) ?? null) : null;
  const importadoDoRubi = Boolean(cargoEmEdicao?.tabSalCodigo);

  function handleImportadoRubi(cargoAtualizado: CargoComVinculo) {
    setCargos((atual) => atual.map((c) => (c.id === cargoAtualizado.id ? cargoAtualizado : c)));
    setDados((d) => ({ ...d, nomeCargoMercado: cargoAtualizado.nomeCargoMercado }));
    setRubiModalAberta(false);
  }

  function iniciarEdicao(cargo: CargoComVinculo | null) {
    setErro(null);
    if (!cargo) {
      setCargoEmEdicaoId(null);
      setDados(dadosVazios());
      return;
    }
    setCargoEmEdicaoId(cargo.id);
    setDados({
      nomeCargoMercado: cargo.nomeCargoMercado,
      // ADR-042 — Cargo Rascunho tem esses campos null; formulário abre em branco/default
      // para o usuário completar o cadastro pela primeira vez.
      unidadeFuncionalId: cargo.unidadeFuncionalId ?? '',
      contaId: cargo.contaId ?? '',
      fonteAtiva: cargo.fonteAtiva ?? 'MERCADO_MINIMO',
      salarioMercadoMinimo: cargo.salarioMercadoMinimo ?? '',
      salarioMercadoMaximo: cargo.salarioMercadoMaximo ?? '',
      origemSalarioMinimo: cargo.origemSalarioMinimo,
      origemSalarioMaximo: cargo.origemSalarioMaximo,
      funcaoGratificada: cargo.funcaoGratificada ?? '',
      contaGratificacaoId: cargo.contaGratificacaoId ?? '',
      periodoInicio: cargo.periodoInicio?.slice(0, 10) ?? '',
      encargosSociaisPct: cargo.encargosSociaisPct,
      contaEncargosSociaisId: cargo.contaEncargosSociaisId ?? '',
      vaAtivo: cargo.vaAtivo,
      vaValorUnitario: cargo.vaValorUnitario,
      contaValeAlimentacaoId: cargo.contaValeAlimentacaoId ?? '',
      vrAtivo: cargo.vrAtivo,
      vrValorUnitario: cargo.vrValorUnitario,
      contaValeRefeicaoId: cargo.contaValeRefeicaoId ?? '',
      planoSaudeAtivo: cargo.planoSaudeAtivo,
      planoSaudeFaixa: cargo.planoSaudeFaixa,
      planoSaudeValor: cargo.planoSaudeValor,
      contaPlanoSaudeId: cargo.contaPlanoSaudeId ?? '',
      planoOdontoAtivo: cargo.planoOdontoAtivo,
      planoOdontoValor: cargo.planoOdontoValor,
      contaPlanoOdontologicoId: cargo.contaPlanoOdontologicoId ?? '',
      seguroVidaAtivo: cargo.seguroVidaAtivo,
      seguroVidaValor: cargo.seguroVidaValor,
      contaSeguroVidaId: cargo.contaSeguroVidaId ?? '',
      auxilioCrecheAtivo: cargo.auxilioCrecheAtivo,
      auxilioCrecheValor: cargo.auxilioCrecheValor,
      contaAuxilioCrecheId: cargo.contaAuxilioCrecheId ?? '',
      transporteAtivo: cargo.transporteAtivo,
      transporteValorUnitario: cargo.transporteValorUnitario,
      contaValeTransporteId: cargo.contaValeTransporteId ?? '',
      periculosidadeAtivo: cargo.periculosidadeAtivo,
      periculosidadeTipo: cargo.periculosidadeTipo,
      periculosidadeValor: cargo.periculosidadeValor,
      contaPericulosidadeId: cargo.contaPericulosidadeId ?? '',
      insalubridadeAtivo: cargo.insalubridadeAtivo,
      insalubridadeTipo: cargo.insalubridadeTipo,
      insalubridadeValor: cargo.insalubridadeValor,
      contaInsalubridadeId: cargo.contaInsalubridadeId ?? '',
    });
  }

  function salvar() {
    setErro(null);
    const payload = {
      propostaId,
      cargoId: cargoEmEdicaoId ?? undefined,
      unidadeFuncionalId: dados.unidadeFuncionalId,
      contaId: dados.contaId,
      nomeCargoMercado: dados.nomeCargoMercado,
      funcaoGratificada: dados.funcaoGratificada === '' ? null : Number(dados.funcaoGratificada),
      contaGratificacaoId: dados.contaGratificacaoId || null,
      periodoInicio: new Date(dados.periodoInicio),
      salarioMercadoMinimo: Number(dados.salarioMercadoMinimo),
      salarioMercadoMaximo: Number(dados.salarioMercadoMaximo),
      origemSalarioMinimo: dados.origemSalarioMinimo,
      origemSalarioMaximo: dados.origemSalarioMaximo,
      fonteAtiva: dados.fonteAtiva,
      encargosSociaisPct: Number(dados.encargosSociaisPct),
      contaEncargosSociaisId: dados.contaEncargosSociaisId || null,
      vaAtivo: dados.vaAtivo,
      vaValorUnitario: Number(dados.vaValorUnitario),
      contaValeAlimentacaoId: dados.contaValeAlimentacaoId || null,
      vrAtivo: dados.vrAtivo,
      vrValorUnitario: Number(dados.vrValorUnitario),
      contaValeRefeicaoId: dados.contaValeRefeicaoId || null,
      planoSaudeAtivo: dados.planoSaudeAtivo,
      planoSaudeFaixa: dados.planoSaudeFaixa,
      planoSaudeValor: Number(dados.planoSaudeValor),
      contaPlanoSaudeId: dados.contaPlanoSaudeId || null,
      planoOdontoAtivo: dados.planoOdontoAtivo,
      planoOdontoValor: Number(dados.planoOdontoValor),
      contaPlanoOdontologicoId: dados.contaPlanoOdontologicoId || null,
      seguroVidaAtivo: dados.seguroVidaAtivo,
      seguroVidaValor: Number(dados.seguroVidaValor),
      contaSeguroVidaId: dados.contaSeguroVidaId || null,
      auxilioCrecheAtivo: dados.auxilioCrecheAtivo,
      auxilioCrecheValor: Number(dados.auxilioCrecheValor),
      contaAuxilioCrecheId: dados.contaAuxilioCrecheId || null,
      transporteAtivo: dados.transporteAtivo,
      transporteValorUnitario: Number(dados.transporteValorUnitario),
      contaValeTransporteId: dados.contaValeTransporteId || null,
      periculosidadeAtivo: dados.periculosidadeAtivo,
      periculosidadeTipo: dados.periculosidadeTipo,
      periculosidadeValor: Number(dados.periculosidadeValor),
      contaPericulosidadeId: dados.contaPericulosidadeId || null,
      insalubridadeAtivo: dados.insalubridadeAtivo,
      insalubridadeTipo: dados.insalubridadeTipo,
      insalubridadeValor: Number(dados.insalubridadeValor),
      contaInsalubridadeId: dados.contaInsalubridadeId || null,
    };

    startTransition(async () => {
      const resposta = await salvarCargoCompleto(payload);

      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        // Sucesso parcial (ADR-028): Cargo foi salvo mesmo com Benefícios falhando — reflete na lista.
        if (resposta.cargoSalvo) {
          const cargoSalvo: CargoComVinculo = resposta.cargoSalvo;
          setCargos((atual) => {
            const existe = atual.some((c) => c.id === cargoSalvo.id);
            return existe ? atual.map((c) => (c.id === cargoSalvo.id ? cargoSalvo : c)) : [...atual, cargoSalvo];
          });
        }
        return;
      }

      const cargoSalvo: CargoComVinculo = resposta.dados;
      setCargos((atual) => {
        const existe = atual.some((c) => c.id === cargoSalvo.id);
        return existe ? atual.map((c) => (c.id === cargoSalvo.id ? cargoSalvo : c)) : [...atual, cargoSalvo];
      });
      iniciarEdicao(null);
    });
  }

  async function ressincronizarEmpregados() {
    if (!cargoEmEdicaoId) return;
    setMensagemRessincronizacao(null);
    setRessincronizando(true);
    try {
      const resposta = await ressincronizarSnapshotEmpregadosCargo(cargoEmEdicaoId);
      if (!resposta.sucesso) {
        setMensagemRessincronizacao(`Falha: ${resposta.mensagem}`);
        return;
      }
      const atualizados = resposta.dados.filter((r) => r.atualizado).length;
      const ignorados = resposta.dados.length - atualizados;
      setMensagemRessincronizacao(
        resposta.dados.length === 0
          ? 'Nenhum empregado vinculado a este cargo.'
          : `${atualizados} empregado(s) atualizado(s)${ignorados > 0 ? `, ${ignorados} ignorado(s) (proposta oficializada)` : ''}.`,
      );
    } finally {
      setRessincronizando(false);
    }
  }

  async function ressincronizarLinha(cargoId: string) {
    setMensagemRessincronizacaoLinha(null);
    setRessincronizandoLinhaId(cargoId);
    try {
      const resposta = await ressincronizarSnapshotEmpregadosCargo(cargoId);
      if (!resposta.sucesso) {
        setMensagemRessincronizacaoLinha({ cargoId, texto: `Falha: ${resposta.mensagem}` });
        return;
      }
      const atualizados = resposta.dados.filter((r) => r.atualizado).length;
      const ignorados = resposta.dados.length - atualizados;
      setMensagemRessincronizacaoLinha({
        cargoId,
        texto:
          resposta.dados.length === 0
            ? 'Nenhum empregado vinculado a este cargo.'
            : `${atualizados} empregado(s) atualizado(s)${ignorados > 0 ? `, ${ignorados} ignorado(s) (proposta oficializada)` : ''}.`,
      });
    } finally {
      setRessincronizandoLinhaId(null);
    }
  }

  function alternarSelecao(cargoId: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(cargoId)) novo.delete(cargoId);
      else novo.add(cargoId);
      return novo;
    });
  }

  function alternarSelecaoTodos() {
    setSelecionados((atual) => (atual.size === cargos.length ? new Set() : new Set(cargos.map((c) => c.id))));
  }

  async function excluirUmCargo(cargoId: string) {
    if (!confirm('Excluir este cargo? Esta ação não pode ser desfeita pela tela.')) return;
    setErroExclusao(null);
    setExcluindo(true);
    try {
      const resposta = await excluirCargo(cargoId);
      if (!resposta.sucesso) {
        setErroExclusao(resposta.mensagem);
        return;
      }
      setCargos((atual) => atual.filter((c) => c.id !== cargoId));
      setSelecionados((atual) => {
        const novo = new Set(atual);
        novo.delete(cargoId);
        return novo;
      });
      if (cargoEmEdicaoId === cargoId) iniciarEdicao(null);
    } finally {
      setExcluindo(false);
    }
  }

  async function excluirSelecionados() {
    if (selecionados.size === 0) return;
    if (!confirm(`Excluir ${selecionados.size} cargo(s) selecionado(s)? Esta ação não pode ser desfeita pela tela.`)) return;
    setErroExclusao(null);
    setExcluindo(true);
    try {
      const ids = Array.from(selecionados);
      const resposta = await excluirCargosEmLote(propostaId, ids);
      if (!resposta.sucesso) {
        setErroExclusao(resposta.mensagem);
        return;
      }
      setCargos((atual) => atual.filter((c) => !selecionados.has(c.id)));
      setSelecionados(new Set());
      if (cargoEmEdicaoId && selecionados.has(cargoEmEdicaoId)) iniciarEdicao(null);
    } finally {
      setExcluindo(false);
    }
  }

  const podeSalvar =
    dados.nomeCargoMercado.trim().length > 0 &&
    dados.unidadeFuncionalId !== '' &&
    dados.contaId !== '' &&
    dados.periodoInicio !== '' &&
    dados.salarioMercadoMinimo !== '' &&
    dados.salarioMercadoMaximo !== '';

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-slate-50 p-4 md:p-6">
      <ResumoExecutivo totalCargos={cargos.length} custoTotalMensal={custoTotalMensal} salarioTotalMensal={salarioTotalMensal} />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-slate-800">
            <span className="text-slate-400">
              <IconeCracha />
            </span>
            Cargos
          </h3>
          {!readOnly && selecionados.size > 0 && (
            <button
              type="button"
              onClick={excluirSelecionados}
              disabled={excluindo}
              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {excluindo ? 'Excluindo...' : `Excluir Selecionados (${selecionados.size})`}
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs text-gray-500">
                {!readOnly && (
                  <th className="w-8 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={cargos.length > 0 && selecionados.size === cargos.length}
                      onChange={alternarSelecaoTodos}
                      aria-label="Selecionar todos os cargos"
                    />
                  </th>
                )}
                <th className="px-4 py-2.5 font-medium">Código</th>
                <th className="px-4 py-2.5 font-medium">Cargo (Mercado)</th>
                <th className="px-4 py-2.5 font-medium">Salário Total</th>
                <th className="px-4 py-2.5 font-medium">Custo Total</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {cargos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-center text-gray-400">
                    Nenhum cargo cadastrado.
                  </td>
                </tr>
              )}
              {cargos.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-slate-100">
                  {!readOnly && (
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selecionados.has(c.id)}
                        onChange={() => alternarSelecao(c.id)}
                        aria-label={`Selecionar cargo ${c.codigoCargo}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2.5">{c.codigoCargo}</td>
                  <td className="px-4 py-2.5">
                    {c.nomeCargoMercado}
                    {c.status === 'RASCUNHO' && (
                      <span
                        className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                        title="Cadastrado só com o nome (Tabela Salarial) — complete Vínculo Funcional, Conta e Salário aqui."
                      >
                        Rascunho
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{formatarMoeda(c.salarioTotal)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{formatarMoeda(c.custoTotalCargo)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => ressincronizarLinha(c.id)}
                          disabled={ressincronizandoLinhaId === c.id}
                          title="Atualiza os Empregados deste Cargo com os valores atuais de salário/benefícios e reflete no saldo das contas."
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {ressincronizandoLinhaId === c.id ? 'Atualizando...' : 'Atualizar Consolidação'}
                        </button>
                        {!readOnly && (
                          <>
                            <button type="button" onClick={() => iniciarEdicao(c)} className="text-xs text-blue-700 hover:underline">
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => excluirUmCargo(c.id)}
                              disabled={excluindo}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                      {mensagemRessincronizacaoLinha?.cargoId === c.id && (
                        <p className="text-xs text-gray-500">{mensagemRessincronizacaoLinha.texto}</p>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {erroExclusao && <p className="text-xs text-red-600">{erroExclusao}</p>}
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm md:p-5">
          <h4 className="text-sm font-semibold text-slate-800">{cargoEmEdicaoId ? 'Editar Cargo' : 'Novo Cargo'}</h4>

          {/* Opção B (mockup "Reorganização de Cargos", 2026-08-14): coluna principal de edição + painel lateral fixo com Rubi/Fonte Ativa/custo. */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_300px]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium text-gray-600">Identificação e Mercado</p>
                <div className="grid grid-cols-1 items-start gap-x-4 gap-y-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Nome do Cargo (Mercado)</label>
                    <input
                      type="text"
                      value={dados.nomeCargoMercado}
                      onChange={(e) => setDados((d) => ({ ...d, nomeCargoMercado: e.target.value }))}
                      disabled={importadoDoRubi}
                      className="w-full rounded border px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                      title={importadoDoRubi ? 'Importado do Rubi — Read-only. Use "Reimportar do Rubi" para trocar.' : undefined}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Conta Contábil (natureza da despesa)</label>
                    <select
                      value={dados.contaId}
                      onChange={(e) => setDados((d) => ({ ...d, contaId: e.target.value }))}
                      className="w-full rounded border px-2 py-1 text-sm"
                    >
                      <option value="">Selecione...</option>
                      {contasAnaliticas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Período Início</label>
                    <input
                      type="date"
                      value={dados.periodoInicio}
                      onChange={(e) => setDados((d) => ({ ...d, periodoInicio: e.target.value }))}
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Salário Mercado Mínimo</label>
                    <input
                      type="number"
                      value={dados.salarioMercadoMinimo}
                      onChange={(e) => setDados((d) => ({ ...d, salarioMercadoMinimo: e.target.value, origemSalarioMinimo: 'MANUAL' }))}
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {dados.origemSalarioMinimo === 'TABELA_SALARIAL' ? 'Preenchido via Tabela Salarial' : 'Editado manualmente'}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Salário Mercado Máximo</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={dados.salarioMercadoMaximo}
                        onChange={(e) => setDados((d) => ({ ...d, salarioMercadoMaximo: e.target.value, origemSalarioMaximo: 'MANUAL' }))}
                        className="w-full rounded border px-2 py-1 text-sm"
                      />
                      {cargoEmEdicaoId && (
                        <button
                          type="button"
                          onClick={() => setTabelaSalarialAberta(true)}
                          className="whitespace-nowrap rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          title="Selecionar ou consultar Tabela Salarial de mercado (US-131/US-133)"
                        >
                          Tabela Salarial
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {dados.origemSalarioMaximo === 'TABELA_SALARIAL' ? 'Preenchido via Tabela Salarial' : 'Editado manualmente'}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Função Gratificada (opcional)</label>
                    <input
                      type="number"
                      value={dados.funcaoGratificada}
                      onChange={(e) => setDados((d) => ({ ...d, funcaoGratificada: e.target.value }))}
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                    <div className="mt-1">
                      <ContaComponenteSelect
                        contasAnaliticas={contasAnaliticas}
                        value={dados.contaGratificacaoId}
                        onChange={(v) => setDados((d) => ({ ...d, contaGratificacaoId: v }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t pt-3">
                <p className="text-xs font-medium text-gray-600">Vínculo Funcional (RN_CAR_08 — custo integral ao setor selecionado)</p>
                <select
                  value={dados.unidadeFuncionalId}
                  onChange={(e) => setDados((d) => ({ ...d, unidadeFuncionalId: e.target.value }))}
                  className="w-full rounded border px-2 py-1 text-sm md:w-1/3"
                >
                  <option value="">Selecione a Unidade Funcional...</option>
                  {unidadesAnaliticas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
                {unidadesAnaliticas.length === 0 && (
                  <p className="text-xs text-gray-400">Cadastre ao menos uma unidade funcional Analítica no Organograma antes de vincular um Cargo.</p>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t pt-3">
                <p className="text-xs font-medium text-gray-600">Benefícios e Encargos</p>

                <div className="grid grid-cols-[minmax(180px,1fr)_128px_minmax(160px,1fr)] items-center gap-x-3 gap-y-2">
                  <label className="text-xs font-medium text-gray-600">Encargos Sociais (%)</label>
                  <div />
                  <div />
                  <div className="border-b border-gray-100 pb-2">
                    <input
                      type="number"
                      value={dados.encargosSociaisPct}
                      onChange={(e) => setDados((d) => ({ ...d, encargosSociaisPct: e.target.value }))}
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="border-b border-gray-100 pb-2" />
                  <div className="border-b border-gray-100 pb-2">
                    <ContaComponenteSelect
                      contasAnaliticas={contasAnaliticas}
                      value={dados.contaEncargosSociaisId}
                      onChange={(v) => setDados((d) => ({ ...d, contaEncargosSociaisId: v }))}
                    />
                  </div>

                  {BENEFICIOS_SIMPLES.map((b) => (
                    <Fragment key={b.ativo}>
                      <label className="flex items-center gap-2 border-b border-gray-100 pb-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={dados[b.ativo]}
                          onChange={(e) => setDados((d) => ({ ...d, [b.ativo]: e.target.checked }))}
                        />
                        {b.label}
                      </label>
                      <div className="border-b border-gray-100 pb-2">
                        <input
                          type="number"
                          value={dados[b.valor]}
                          onChange={(e) => setDados((d) => ({ ...d, [b.valor]: e.target.value }))}
                          disabled={!dados[b.ativo]}
                          className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50"
                        />
                      </div>
                      <div className="border-b border-gray-100 pb-2">
                        <ContaComponenteSelect
                          contasAnaliticas={contasAnaliticas}
                          value={dados[b.conta]}
                          onChange={(v) => setDados((d) => ({ ...d, [b.conta]: v }))}
                          disabled={!dados[b.ativo]}
                        />
                      </div>
                    </Fragment>
                  ))}

                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={dados.planoSaudeAtivo}
                      onChange={(e) => setDados((d) => ({ ...d, planoSaudeAtivo: e.target.checked }))}
                    />
                    Plano de Saúde
                  </label>
                  <div />
                  <div />
                  <div className="flex items-center gap-2">
                    <select
                      value={dados.planoSaudeFaixa ?? ''}
                      onChange={(e) => setDados((d) => ({ ...d, planoSaudeFaixa: (e.target.value || null) as typeof d.planoSaudeFaixa }))}
                      disabled={!dados.planoSaudeAtivo}
                      className="w-32 shrink-0 rounded border px-2 py-1 text-sm disabled:opacity-50"
                    >
                      <option value="">Faixa...</option>
                      <option value="BASICO">Básico</option>
                      <option value="INTERMEDIARIO">Intermediário</option>
                      <option value="EXECUTIVO">Executivo</option>
                    </select>
                    <input
                      type="number"
                      value={dados.planoSaudeValor}
                      onChange={(e) => setDados((d) => ({ ...d, planoSaudeValor: e.target.value }))}
                      disabled={!dados.planoSaudeAtivo}
                      className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50"
                    />
                  </div>
                  <div />
                  <div>
                    <ContaComponenteSelect
                      contasAnaliticas={contasAnaliticas}
                      value={dados.contaPlanoSaudeId}
                      onChange={(v) => setDados((d) => ({ ...d, contaPlanoSaudeId: v }))}
                      disabled={!dados.planoSaudeAtivo}
                    />
                  </div>

                  {ADICIONAIS.map((a) => (
                    <Fragment key={a.ativo}>
                      <label
                        className="flex items-center gap-2 border-t border-gray-100 pt-2 text-xs text-gray-600"
                        title="Cumulação com CLT pode não ser válida — o sistema não bloqueia, decisão de RH/jurídico do tenant."
                      >
                        <input
                          type="checkbox"
                          checked={dados[a.ativo]}
                          onChange={(e) =>
                            setDados((d) => ({
                              ...d,
                              [a.ativo]: e.target.checked,
                              ...(e.target.checked ? {} : { [a.tipo]: null, [a.valor]: '0' }),
                            }))
                          }
                        />
                        {a.label}
                      </label>
                      <div className="border-t border-gray-100 pt-2" />
                      <div className="border-t border-gray-100 pt-2" />
                      <div className="flex items-center gap-2">
                        <select
                          value={dados[a.tipo] ?? ''}
                          onChange={(e) =>
                            // US-136, Cenário 5 — trocar o tipo reinicia o Valor (client-side, não persiste até salvar).
                            setDados((d) => ({
                              ...d,
                              [a.tipo]: (e.target.value || null) as 'PERCENTUAL' | 'VALOR_FIXO' | null,
                              [a.valor]: '0',
                            }))
                          }
                          disabled={!dados[a.ativo]}
                          className="w-32 shrink-0 rounded border px-2 py-1 text-sm disabled:opacity-50"
                        >
                          <option value="">Tipo...</option>
                          <option value="PERCENTUAL">Percentual (%)</option>
                          <option value="VALOR_FIXO">Valor Fixo (R$)</option>
                        </select>
                        <input
                          type="number"
                          value={dados[a.valor]}
                          onChange={(e) => setDados((d) => ({ ...d, [a.valor]: e.target.value }))}
                          disabled={!dados[a.ativo]}
                          className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50"
                        />
                      </div>
                      <div />
                      <div>
                        <SeletorContaAnalitica
                          contas={contasAnaliticas}
                          value={dados[a.conta]}
                          onChange={(v) => setDados((d) => ({ ...d, [a.conta]: v }))}
                          disabled={!dados[a.ativo]}
                        />
                      </div>
                    </Fragment>
                  ))}
                </div>
              </div>

              {erro && <p className="text-xs text-red-600">{erro}</p>}

              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={salvar}
                  disabled={pending || !podeSalvar}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {pending ? 'Salvando...' : 'Salvar Cargo'}
                </button>
                {cargoEmEdicaoId && (
                  <button type="button" onClick={() => iniciarEdicao(null)} className="text-sm text-gray-500 hover:underline">
                    Cancelar
                  </button>
                )}
                {cargoEmEdicaoId && (
                  <button
                    type="button"
                    onClick={ressincronizarEmpregados}
                    disabled={ressincronizando}
                    title="Atualiza o custo/conta dos Empregados já cadastrados deste Cargo com os benefícios salvos acima. Empregados de Proposta oficializada não são alterados."
                    className="rounded border border-blue-600 px-3 py-1.5 text-sm text-blue-700 disabled:opacity-50"
                  >
                    {ressincronizando ? 'Ressincronizando...' : 'Ressincronizar Empregados'}
                  </button>
                )}
                {mensagemRessincronizacao && <p className="w-full text-xs text-gray-600">{mensagemRessincronizacao}</p>}
              </div>
            </div>

            <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
              {cargoEmEdicaoId && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-gray-600">Rubi — Tabela Salarial, Faixa, Nível e Salário Real</p>
                  {importadoDoRubi && cargoEmEdicao ? (
                    <>
                      <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-gray-100 bg-slate-50 p-3 text-xs">
                        <p><span className="font-medium text-gray-500">Salário Real:</span> {formatarMoeda(cargoEmEdicao.salarioReal ?? '0')}</p>
                        <p><span className="font-medium text-gray-500">Tabela Salarial:</span> {cargoEmEdicao.tabSalDescricao}</p>
                        <p><span className="font-medium text-gray-500">Faixa:</span> {cargoEmEdicao.faixaDescricao}</p>
                        <p><span className="font-medium text-gray-500">Nível:</span> {cargoEmEdicao.nivelDescricao}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRubiModalAberta(true)}
                        className="w-fit rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Reimportar do Rubi
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRubiModalAberta(true)}
                      className="w-fit rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Importar do Rubi
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Fonte Ativa</label>
                <select
                  value={dados.fonteAtiva}
                  onChange={(e) => setDados((d) => ({ ...d, fonteAtiva: e.target.value as (typeof FONTES)[number]['value'] }))}
                  className="w-full rounded border px-2 py-1 text-sm"
                >
                  {FONTES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {cargoEmEdicao && (
                <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-slate-50 p-3 text-xs">
                  <p className="font-medium text-gray-600">Custo do Cargo (última gravação)</p>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Salário Total</span>
                    <span className="tabular-nums">{formatarMoeda(cargoEmEdicao.salarioTotal)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2 font-medium text-slate-800">
                    <span>Custo Total</span>
                    <span className="tabular-nums">{formatarMoeda(cargoEmEdicao.custoTotalCargo)}</span>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}

      {rubiModalAberta && cargoEmEdicaoId && (
        <ImportarCargoRubiModal cargoId={cargoEmEdicaoId} onFechar={() => setRubiModalAberta(false)} onImportado={handleImportadoRubi} />
      )}

      {tabelaSalarialAberta && cargoEmEdicaoId && (
        <TabelaSalarialModal
          cargoId={cargoEmEdicaoId}
          cargoNome={dados.nomeCargoMercado || 'Cargo'}
          onFechar={() => setTabelaSalarialAberta(false)}
          onSelecionarFaixa={(faixa) => {
            setDados((d) => ({
              ...d,
              salarioMercadoMinimo: faixa.salarioMinimo,
              salarioMercadoMaximo: faixa.salarioMaximo,
              origemSalarioMinimo: 'TABELA_SALARIAL',
              origemSalarioMaximo: 'TABELA_SALARIAL',
            }));
            setTabelaSalarialAberta(false);
          }}
        />
      )}
    </div>
  );
}
