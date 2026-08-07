'use client';

import { useState, useTransition } from 'react';
import {
  salvarCargoCompleto,
  ressincronizarSnapshotEmpregadosCargo,
  excluirCargo,
  excluirCargosEmLote,
  type CargoResultado,
  type UnidadeFuncionalResultado,
} from './estrutura-actions';

type Alocacao = { unidadeFuncionalId: string; percentual: string };
type CargoComAlocacoes = CargoResultado & { alocacoes: Alocacao[] };

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

/** ADR-029 — seletor de conta analítica de um componente de custo, reaproveitado em todos os campos. */
function ContaComponenteSelect({
  contasAnaliticas,
  value,
  onChange,
}: {
  contasAnaliticas: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border px-2 py-1 text-xs text-gray-600"
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
    contaId: '',
    fonteAtiva: 'MERCADO_MINIMO' as (typeof FONTES)[number]['value'],
    salarioMercadoMinimo: '',
    salarioMercadoMaximo: '',
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
  };
}

/**
 * US-117 (UC03.19, blocos A/B/C) — Gerenciar Cargos: dados de mercado, conta,
 * rateio funcional e benefícios/encargos, tudo sob um único "Salvar Cargo"
 * (ADR-028 — orquestrado por salvarCargoCompleto, que por baixo ainda chama
 * os use cases de domínio separados de Cargo e de Benefícios).
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
  cargosIniciais: CargoComAlocacoes[];
  readOnly?: boolean;
}) {
  const [cargos, setCargos] = useState(cargosIniciais);
  const [cargoEmEdicaoId, setCargoEmEdicaoId] = useState<string | null>(null);
  const [dados, setDados] = useState(dadosVazios());
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ressincronizando, setRessincronizando] = useState(false);
  const [mensagemRessincronizacao, setMensagemRessincronizacao] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const somaPercentual = alocacoes.reduce((soma, a) => soma + (Number(a.percentual) || 0), 0);

  function iniciarEdicao(cargo: CargoComAlocacoes | null) {
    setErro(null);
    if (!cargo) {
      setCargoEmEdicaoId(null);
      setDados(dadosVazios());
      setAlocacoes([]);
      return;
    }
    setCargoEmEdicaoId(cargo.id);
    setDados({
      nomeCargoMercado: cargo.nomeCargoMercado,
      contaId: cargo.contaId,
      fonteAtiva: cargo.fonteAtiva,
      salarioMercadoMinimo: cargo.salarioMercadoMinimo,
      salarioMercadoMaximo: cargo.salarioMercadoMaximo,
      funcaoGratificada: cargo.funcaoGratificada ?? '',
      contaGratificacaoId: cargo.contaGratificacaoId ?? '',
      periodoInicio: cargo.periodoInicio.slice(0, 10),
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
    });
    setAlocacoes(cargo.alocacoes);
  }

  function adicionarAlocacao() {
    if (unidadesAnaliticas.length === 0) return;
    setAlocacoes((atual) => [...atual, { unidadeFuncionalId: unidadesAnaliticas[0].id, percentual: '' }]);
  }

  function atualizarAlocacao(index: number, campo: keyof Alocacao, valor: string) {
    setAlocacoes((atual) => atual.map((a, i) => (i === index ? { ...a, [campo]: valor } : a)));
  }

  function removerAlocacao(index: number) {
    setAlocacoes((atual) => atual.filter((_, i) => i !== index));
  }

  function salvar() {
    setErro(null);
    const payload = {
      propostaId,
      cargoId: cargoEmEdicaoId ?? undefined,
      alocacoes: alocacoes.map((a) => ({ unidadeFuncionalId: a.unidadeFuncionalId, percentual: Number(a.percentual) })),
      contaId: dados.contaId,
      nomeCargoMercado: dados.nomeCargoMercado,
      funcaoGratificada: dados.funcaoGratificada === '' ? null : Number(dados.funcaoGratificada),
      contaGratificacaoId: dados.contaGratificacaoId || null,
      periodoInicio: new Date(dados.periodoInicio),
      salarioMercadoMinimo: Number(dados.salarioMercadoMinimo),
      salarioMercadoMaximo: Number(dados.salarioMercadoMaximo),
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
    };

    startTransition(async () => {
      const resposta = await salvarCargoCompleto(payload);

      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        // Sucesso parcial (ADR-028): Cargo foi salvo mesmo com Benefícios falhando — reflete na lista.
        if (resposta.cargoSalvo) {
          const cargoSalvo: CargoComAlocacoes = { ...resposta.cargoSalvo, alocacoes };
          setCargos((atual) => {
            const existe = atual.some((c) => c.id === cargoSalvo.id);
            return existe ? atual.map((c) => (c.id === cargoSalvo.id ? cargoSalvo : c)) : [...atual, cargoSalvo];
          });
        }
        return;
      }

      const cargoSalvo: CargoComAlocacoes = { ...resposta.dados, alocacoes };
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
    dados.contaId !== '' &&
    dados.periodoInicio !== '' &&
    dados.salarioMercadoMinimo !== '' &&
    dados.salarioMercadoMaximo !== '' &&
    alocacoes.length > 0 &&
    Math.abs(somaPercentual - 100) < 0.01;

  return (
    <div className="flex flex-col gap-4 rounded border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Cargos</h3>
        {!readOnly && selecionados.size > 0 && (
          <button
            type="button"
            onClick={excluirSelecionados}
            disabled={excluindo}
            className="rounded border border-red-600 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
          >
            {excluindo ? 'Excluindo...' : `Excluir Selecionados (${selecionados.size})`}
          </button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-gray-500">
            {!readOnly && (
              <th className="w-8 py-1">
                <input
                  type="checkbox"
                  checked={cargos.length > 0 && selecionados.size === cargos.length}
                  onChange={alternarSelecaoTodos}
                  aria-label="Selecionar todos os cargos"
                />
              </th>
            )}
            <th className="py-1">Código</th>
            <th className="py-1">Cargo (Mercado)</th>
            <th className="py-1">Salário Total</th>
            <th className="py-1">Custo Total</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {cargos.length === 0 && (
            <tr>
              <td colSpan={6} className="py-3 text-center text-gray-400">
                Nenhum cargo cadastrado.
              </td>
            </tr>
          )}
          {cargos.map((c) => (
            <tr key={c.id} className="border-b last:border-0">
              {!readOnly && (
                <td className="py-1.5">
                  <input
                    type="checkbox"
                    checked={selecionados.has(c.id)}
                    onChange={() => alternarSelecao(c.id)}
                    aria-label={`Selecionar cargo ${c.codigoCargo}`}
                  />
                </td>
              )}
              <td className="py-1.5">{c.codigoCargo}</td>
              <td className="py-1.5">{c.nomeCargoMercado}</td>
              <td className="py-1.5">R$ {c.salarioTotal}</td>
              <td className="py-1.5">R$ {c.custoTotalCargo}</td>
              <td className="py-1.5 text-right">
                {!readOnly && (
                  <>
                    <button type="button" onClick={() => iniciarEdicao(c)} className="text-xs text-blue-700 hover:underline">
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => excluirUmCargo(c.id)}
                      disabled={excluindo}
                      className="ml-2 text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      Excluir
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {erroExclusao && <p className="text-xs text-red-600">{erroExclusao}</p>}

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {!readOnly && (
        <div className="flex flex-col gap-4 border-t pt-3">
          <p className="text-xs font-medium text-gray-600">{cargoEmEdicaoId ? 'Editar Cargo' : 'Novo Cargo'}</p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nome do Cargo (Mercado)</label>
              <input
                type="text"
                value={dados.nomeCargoMercado}
                onChange={(e) => setDados((d) => ({ ...d, nomeCargoMercado: e.target.value }))}
                className="w-full rounded border px-2 py-1 text-sm"
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
                onChange={(e) => setDados((d) => ({ ...d, salarioMercadoMinimo: e.target.value }))}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Salário Mercado Máximo</label>
              <input
                type="number"
                value={dados.salarioMercadoMaximo}
                onChange={(e) => setDados((d) => ({ ...d, salarioMercadoMaximo: e.target.value }))}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Função Gratificada (opcional)</label>
              <input
                type="number"
                value={dados.funcaoGratificada}
                onChange={(e) => setDados((d) => ({ ...d, funcaoGratificada: e.target.value }))}
                className="w-full rounded border px-2 py-1 text-sm"
              />
              <ContaComponenteSelect
                contasAnaliticas={contasAnaliticas}
                value={dados.contaGratificacaoId}
                onChange={(v) => setDados((d) => ({ ...d, contaGratificacaoId: v }))}
              />
            </div>
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
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">
                Rateio Funcional (soma deve ser 100% — atual: {somaPercentual.toFixed(2)}%)
              </p>
              <button type="button" onClick={adicionarAlocacao} className="text-xs text-blue-700 hover:underline">
                + Adicionar unidade
              </button>
            </div>
            {alocacoes.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={a.unidadeFuncionalId}
                  onChange={(e) => atualizarAlocacao(i, 'unidadeFuncionalId', e.target.value)}
                  className="flex-1 rounded border px-2 py-1 text-sm"
                >
                  {unidadesAnaliticas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={a.percentual}
                  onChange={(e) => atualizarAlocacao(i, 'percentual', e.target.value)}
                  placeholder="%"
                  className="w-24 rounded border px-2 py-1 text-sm"
                />
                <button type="button" onClick={() => removerAlocacao(i)} className="text-xs text-red-600 hover:underline">
                  Remover
                </button>
              </div>
            ))}
            {unidadesAnaliticas.length === 0 && (
              <p className="text-xs text-gray-400">Cadastre ao menos uma unidade funcional Analítica no Organograma antes de vincular um Cargo.</p>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t pt-3">
            <p className="text-xs font-medium text-gray-600">Benefícios e Encargos</p>

            <div className="flex items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Encargos Sociais (%)</label>
                <input
                  type="number"
                  value={dados.encargosSociaisPct}
                  onChange={(e) => setDados((d) => ({ ...d, encargosSociaisPct: e.target.value }))}
                  className="w-32 rounded border px-2 py-1 text-sm"
                />
              </div>
              <ContaComponenteSelect
                contasAnaliticas={contasAnaliticas}
                value={dados.contaEncargosSociaisId}
                onChange={(v) => setDados((d) => ({ ...d, contaEncargosSociaisId: v }))}
              />
            </div>

            {BENEFICIOS_SIMPLES.map((b) => (
              <div key={b.ativo} className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={dados[b.ativo]}
                    onChange={(e) => setDados((d) => ({ ...d, [b.ativo]: e.target.checked }))}
                  />
                  {b.label}
                </label>
                <input
                  type="number"
                  value={dados[b.valor]}
                  onChange={(e) => setDados((d) => ({ ...d, [b.valor]: e.target.value }))}
                  disabled={!dados[b.ativo]}
                  className="w-32 rounded border px-2 py-1 text-sm disabled:opacity-50"
                />
                <ContaComponenteSelect
                  contasAnaliticas={contasAnaliticas}
                  value={dados[b.conta]}
                  onChange={(v) => setDados((d) => ({ ...d, [b.conta]: v }))}
                />
              </div>
            ))}

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={dados.planoSaudeAtivo}
                  onChange={(e) => setDados((d) => ({ ...d, planoSaudeAtivo: e.target.checked }))}
                />
                Plano de Saúde
              </label>
              <select
                value={dados.planoSaudeFaixa ?? ''}
                onChange={(e) => setDados((d) => ({ ...d, planoSaudeFaixa: (e.target.value || null) as typeof d.planoSaudeFaixa }))}
                disabled={!dados.planoSaudeAtivo}
                className="rounded border px-2 py-1 text-sm disabled:opacity-50"
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
                className="w-32 rounded border px-2 py-1 text-sm disabled:opacity-50"
              />
              <ContaComponenteSelect
                contasAnaliticas={contasAnaliticas}
                value={dados.contaPlanoSaudeId}
                onChange={(v) => setDados((d) => ({ ...d, contaPlanoSaudeId: v }))}
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={salvar}
              disabled={pending || !podeSalvar}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {pending ? 'Salvando...' : 'Salvar Cargo'}
            </button>
            {cargoEmEdicaoId && (
              <button type="button" onClick={() => iniciarEdicao(null)} className="ml-2 text-sm text-gray-500 hover:underline">
                Cancelar
              </button>
            )}
            {cargoEmEdicaoId && !readOnly && (
              <button
                type="button"
                onClick={ressincronizarEmpregados}
                disabled={ressincronizando}
                title="Atualiza o custo/conta dos Empregados já cadastrados deste Cargo com os benefícios salvos acima. Empregados de Proposta oficializada não são alterados."
                className="ml-2 rounded border border-blue-600 px-3 py-1.5 text-sm text-blue-700 disabled:opacity-50"
              >
                {ressincronizando ? 'Ressincronizando...' : 'Ressincronizar Empregados'}
              </button>
            )}
            {mensagemRessincronizacao && <p className="mt-1 text-xs text-gray-600">{mensagemRessincronizacao}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
