'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  simularReajuste,
  aplicarReajuste,
  type PlanoReajusteLoteResultado,
} from '@/app/(autenticado)/plano-contas/actions';
import {
  listarAliquotasImposto,
  editarAliquotaImposto,
  excluirAliquotaImposto,
  type AliquotaImpostoResultado,
} from '@/app/(autenticado)/aliquotas-impostos/actions';
import { SeletorContaAnalitica } from '@/app/(autenticado)/propostas/SeletorContaAnalitica';

const formatadorMes = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatarMoeda(valor: string): string {
  return formatadorMoeda.format(Number(valor));
}

// [ultrareview 2026-08-11] AGRUPADOR já existe de ponta a ponta no backend
// (EscopoReajusteSchema, resolverEscopo em prepararPlanoReajuste.ts, testado em
// AplicarReajusteUseCase.test.ts) mas ainda não tem seletor aqui — entrega
// incremental deliberada, não esquecimento. UI pendente de US futura.
type EscopoModo = 'CONTA' | 'GLOBAL';
type ContaOpcao = { id: string; label: string };
type TipoIncidencia = 'CONTRATO' | 'TERMO_DE_PARCERIA' | 'AMBOS';
type Periodicidade = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

const PERIODICIDADE_LABEL: Record<Periodicidade, string> = {
  MENSAL: 'Mensal',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};

type FormEdicaoState = {
  nome: string;
  aliquotaPct: string;
  tipoIncidencia: TipoIncidencia;
  dataInicioVigencia: string;
  dataFimVigencia: string;
  limiteMinimoPct: string;
  limiteMaximoPct: string;
  observacao: string;
  contaSinteticaId: string;
  periodicidadeReajuste: Periodicidade;
};

function paraFormEdicao(a: AliquotaImpostoResultado): FormEdicaoState {
  return {
    nome: a.nome,
    aliquotaPct: a.aliquotaPct,
    tipoIncidencia: a.tipoIncidencia,
    dataInicioVigencia: a.dataInicioVigencia.slice(0, 10),
    dataFimVigencia: a.dataFimVigencia?.slice(0, 10) ?? '',
    limiteMinimoPct: a.limiteMinimoPct ?? '',
    limiteMaximoPct: a.limiteMaximoPct ?? '',
    observacao: a.observacao ?? '',
    contaSinteticaId: a.contaSinteticaId ?? '',
    periodicidadeReajuste: a.periodicidadeReajuste,
  };
}

/**
 * US-129/UC04.02 — Simular e Aplicar Reajuste em Lote. Fluxo em 2 passos:
 * simular (Cenário 9, preview sem gravar) e confirmar (Cenários 10-14, grava
 * tudo em 1 transação). [TRAVA O ERRO] em erro na confirmação, o modal continua
 * aberto com os dados preservados (Cenário 14) — nunca fecha sozinho.
 *
 * [2026-08-11] Editar/Excluir o índice (AliquotaImpostoParametro) direto daqui,
 * reaproveitando as Server Actions de UC03.41/42 (mesma trava de exclusão
 * bloqueada por referência ativa, AliquotaImpostoReferenciadaError) — sem
 * duplicar lógica, só trazendo os botões para o fluxo de reajuste.
 */
export function ReajusteLoteModal({
  versaoId,
  contasAnaliticas,
  aliquotas,
  opcoesContaSintetica,
  podeEditarIndice,
  podeExcluirIndice,
}: {
  versaoId: string;
  contasAnaliticas: { id: string; label: string }[];
  aliquotas: { id: string; label: string; periodicidadeReajuste: Periodicidade }[];
  opcoesContaSintetica: ContaOpcao[];
  podeEditarIndice: boolean;
  podeExcluirIndice: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [aliquotasLista, setAliquotasLista] = useState(aliquotas);
  const [aliquotaParametroId, setAliquotaParametroId] = useState(aliquotas[0]?.id ?? '');
  const [escopoModo, setEscopoModo] = useState<EscopoModo>('GLOBAL');
  const [contaId, setContaId] = useState(contasAnaliticas[0]?.id ?? '');
  const [plano, setPlano] = useState<PlanoReajusteLoteResultado | null>(null);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendingSimular, startSimular] = useTransition();
  const [pendingAplicar, startAplicar] = useTransition();

  const [edicaoAberta, setEdicaoAberta] = useState(false);
  const [formEdicao, setFormEdicao] = useState<FormEdicaoState | null>(null);
  const [versionEdicao, setVersionEdicao] = useState(0);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const [pendingEdicao, startEdicao] = useTransition();

  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [pendingExclusao, startExclusao] = useTransition();

  const labelPorConta = useMemo(() => new Map(contasAnaliticas.map((c) => [c.id, c.label])), [contasAnaliticas]);
  const aliquotaAtual = useMemo(() => aliquotasLista.find((a) => a.id === aliquotaParametroId) ?? null, [aliquotasLista, aliquotaParametroId]);

  function fechar() {
    setAberto(false);
    setPlano(null);
    setConcluido(false);
    setErro(null);
    setEdicaoAberta(false);
    setConfirmandoExclusao(false);
  }

  function escopoAtual() {
    return escopoModo === 'CONTA' ? ({ modo: 'CONTA', contaId } as const) : ({ modo: 'GLOBAL' } as const);
  }

  function simular() {
    setErro(null);
    startSimular(async () => {
      const resposta = await simularReajuste({ versaoId, aliquotaParametroId, escopo: escopoAtual() });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setPlano(resposta.dados);
    });
  }

  function confirmar() {
    setErro(null);
    startAplicar(async () => {
      const resposta = await aplicarReajuste({ versaoId, aliquotaParametroId, escopo: escopoAtual() });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setPlano(resposta.dados);
      setConcluido(true);
    });
  }

  function abrirEdicao() {
    setErroEdicao(null);
    setConfirmandoExclusao(false);
    startEdicao(async () => {
      const resposta = await listarAliquotasImposto();
      if (!resposta.sucesso) {
        setErroEdicao(resposta.mensagem);
        return;
      }
      const registro = resposta.dados.find((a) => a.id === aliquotaParametroId);
      if (!registro) {
        setErroEdicao('Índice não encontrado. Recarregue a página e tente novamente.');
        return;
      }
      setFormEdicao(paraFormEdicao(registro));
      setVersionEdicao(registro.version);
      setEdicaoAberta(true);
    });
  }

  function salvarEdicao() {
    if (!formEdicao) return;
    setErroEdicao(null);
    startEdicao(async () => {
      const resposta = await editarAliquotaImposto(aliquotaParametroId, versionEdicao, {
        ...formEdicao,
        dataFimVigencia: formEdicao.dataFimVigencia || null,
        limiteMinimoPct: formEdicao.limiteMinimoPct || null,
        limiteMaximoPct: formEdicao.limiteMaximoPct || null,
        observacao: formEdicao.observacao || null,
        contaSinteticaId: formEdicao.contaSinteticaId || null,
      });
      if (!resposta.sucesso) {
        setErroEdicao(resposta.mensagem);
        return;
      }
      setAliquotasLista((lista) =>
        lista.map((a) =>
          a.id === aliquotaParametroId
            ? { ...a, label: `${formEdicao.nome} (${formEdicao.aliquotaPct}%)`, periodicidadeReajuste: formEdicao.periodicidadeReajuste }
            : a,
        ),
      );
      setEdicaoAberta(false);
      setPlano(null);
    });
  }

  function excluir() {
    setErroExclusao(null);
    startExclusao(async () => {
      const resposta = await excluirAliquotaImposto(aliquotaParametroId);
      if (!resposta.sucesso) {
        setErroExclusao(resposta.mensagem);
        return;
      }
      const restante = aliquotasLista.filter((a) => a.id !== aliquotaParametroId);
      setAliquotasLista(restante);
      setAliquotaParametroId(restante[0]?.id ?? '');
      setConfirmandoExclusao(false);
      setPlano(null);
    });
  }

  if (aliquotasLista.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 print:hidden"
      >
        Aplicar Reajuste em Lote
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-auto rounded-[10px] border border-gray-200 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">Simular e Aplicar Reajuste em Lote</h3>

            {!concluido && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Índice de Reajuste</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={aliquotaParametroId}
                      onChange={(e) => {
                        setAliquotaParametroId(e.target.value);
                        setPlano(null);
                        setEdicaoAberta(false);
                        setConfirmandoExclusao(false);
                      }}
                      disabled={pendingSimular || pendingAplicar}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                    >
                      {aliquotasLista.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    {podeEditarIndice && (
                      <button
                        type="button"
                        onClick={abrirEdicao}
                        disabled={pendingEdicao || pendingExclusao}
                        title="Editar índice"
                        className="rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Editar
                      </button>
                    )}
                    {podeExcluirIndice && (
                      <button
                        type="button"
                        onClick={() => {
                          setErroExclusao(null);
                          setConfirmandoExclusao(true);
                          setEdicaoAberta(false);
                        }}
                        disabled={pendingEdicao || pendingExclusao}
                        title="Excluir índice"
                        className="rounded border border-gray-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Periodicidade do Reajuste</label>
                  <div className="flex h-[34px] items-center rounded border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700">
                    {aliquotaAtual ? PERIODICIDADE_LABEL[aliquotaAtual.periodicidadeReajuste] : '—'}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Escopo</label>
                  <select
                    value={escopoModo}
                    onChange={(e) => {
                      setEscopoModo(e.target.value as EscopoModo);
                      setPlano(null);
                    }}
                    disabled={pendingSimular || pendingAplicar}
                    className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="GLOBAL">Todas as contas já parametrizadas</option>
                    <option value="CONTA">Uma conta analítica específica</option>
                  </select>
                </div>
                {escopoModo === 'CONTA' && (
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Conta Analítica</label>
                    <SeletorContaAnalitica
                      contas={contasAnaliticas}
                      value={contaId}
                      onChange={(id) => {
                        setContaId(id);
                        setPlano(null);
                      }}
                      disabled={pendingSimular || pendingAplicar}
                    />
                  </div>
                )}
              </div>
            )}

            {confirmandoExclusao && (
              <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-800">
                  Tem certeza que deseja excluir este índice? A exclusão só é permitida se ele não estiver sendo usado em nenhuma Proposta/Contrato ativo.
                </p>
                {erroExclusao && <p className="text-xs font-medium text-red-700">{erroExclusao}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(false)}
                    disabled={pendingExclusao}
                    className="rounded-[7px] border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={excluir}
                    disabled={pendingExclusao}
                    className="rounded-[7px] bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
                  >
                    {pendingExclusao ? 'Excluindo...' : 'Confirmar Exclusão'}
                  </button>
                </div>
              </div>
            )}

            {edicaoAberta && formEdicao && (
              <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-slate-50 p-3">
                <h4 className="text-sm font-semibold text-slate-800">Editar Índice</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Nome</label>
                    <input
                      type="text"
                      value={formEdicao.nome}
                      onChange={(e) => setFormEdicao({ ...formEdicao, nome: e.target.value })}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Alíquota (%)</label>
                    <input
                      type="text"
                      value={formEdicao.aliquotaPct}
                      onChange={(e) => setFormEdicao({ ...formEdicao, aliquotaPct: e.target.value })}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Tipo de Incidência</label>
                    <select
                      value={formEdicao.tipoIncidencia}
                      onChange={(e) => setFormEdicao({ ...formEdicao, tipoIncidencia: e.target.value as TipoIncidencia })}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="CONTRATO">Contrato</option>
                      <option value="TERMO_DE_PARCERIA">Termo de Parceria</option>
                      <option value="AMBOS">Ambos</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Periodicidade do Reajuste</label>
                    <select
                      value={formEdicao.periodicidadeReajuste}
                      onChange={(e) => setFormEdicao({ ...formEdicao, periodicidadeReajuste: e.target.value as Periodicidade })}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="MENSAL">Mensal</option>
                      <option value="TRIMESTRAL">Trimestral</option>
                      <option value="SEMESTRAL">Semestral</option>
                      <option value="ANUAL">Anual</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Conta Sintética (sugestão)</label>
                    <select
                      value={formEdicao.contaSinteticaId}
                      onChange={(e) => setFormEdicao({ ...formEdicao, contaSinteticaId: e.target.value })}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">—</option>
                      {opcoesContaSintetica.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Data Início Vigência</label>
                    <input
                      type="date"
                      value={formEdicao.dataInicioVigencia}
                      onChange={(e) => setFormEdicao({ ...formEdicao, dataInicioVigencia: e.target.value })}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Data Fim Vigência</label>
                    <input
                      type="date"
                      value={formEdicao.dataFimVigencia}
                      onChange={(e) => setFormEdicao({ ...formEdicao, dataFimVigencia: e.target.value })}
                      className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                {erroEdicao && <p className="text-xs text-red-600">{erroEdicao}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEdicaoAberta(false)}
                    disabled={pendingEdicao}
                    className="rounded-[7px] border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={salvarEdicao}
                    disabled={pendingEdicao}
                    className="rounded-[7px] bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
                  >
                    {pendingEdicao ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {erro && <p className="text-xs text-red-600">{erro}</p>}

            {plano && (
              <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-slate-50 p-3">
                <p className="text-xs text-gray-500">
                  {concluido ? 'Reajuste aplicado com' : 'Preview do reajuste com'} <span className="font-semibold text-slate-800">{plano.aliquotaParametroNome}</span> (
                  {plano.aliquotaAplicadaPct}%) — {plano.planos.length} conta(s) analítica(s).
                </p>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full min-w-[500px] border-collapse text-left text-xs">
                    <thead className="bg-white text-gray-500">
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">Conta</th>
                        <th className="px-2 py-1.5 text-right font-semibold">Meses futuros</th>
                        <th className="px-2 py-1.5 text-right font-semibold">Ajuste retroativo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plano.planos.map((p) => (
                        <tr key={p.contaId} className="border-t border-gray-100">
                          <td className="px-2 py-1.5 text-slate-700">{labelPorConta.get(p.contaId) ?? p.contaId}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{p.linhasFuturas.length}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                            {p.ajusteRetroativo ? (
                              <span title={`Meses afetados: ${p.ajusteRetroativo.mesesAfetados.join(', ')}`}>
                                {formatarMoeda(p.ajusteRetroativo.valorAjuste)} em {formatadorMes.format(new Date(p.ajusteRetroativo.competenciaAjuste))}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {concluido ? (
              <div className="flex justify-end">
                <button type="button" onClick={fechar} className="rounded-[7px] bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:brightness-110">
                  Fechar
                </button>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={fechar}
                  disabled={pendingSimular || pendingAplicar}
                  className="rounded-[7px] border border-gray-200 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={simular}
                  disabled={pendingSimular || pendingAplicar}
                  className="rounded-[7px] border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {pendingSimular ? 'Simulando...' : 'Simular'}
                </button>
                <button
                  type="button"
                  onClick={confirmar}
                  disabled={!plano || pendingSimular || pendingAplicar}
                  className="rounded-[7px] bg-blue-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-50"
                >
                  {pendingAplicar ? 'Aplicando...' : 'Confirmar Reajuste'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
