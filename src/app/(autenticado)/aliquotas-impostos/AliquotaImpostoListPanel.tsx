'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  listarAliquotasImposto,
  cadastrarAliquotaImposto,
  editarAliquotaImposto,
  excluirAliquotaImposto,
  type AliquotaImpostoResultado,
} from './actions';
import { exportarParaPDF, exportarParaXLSX } from '@/lib/export/exportarRelatorio';
import { SeletorContaAnalitica } from '@/app/(autenticado)/propostas/SeletorContaAnalitica';

type ContaOpcao = { id: string; label: string };
type PropostaOpcao = { id: string; label: string; versaoVigenteId: string; dataInicio: string };
type TipoIncidencia = 'CONTRATO' | 'TERMO_DE_PARCERIA' | 'AMBOS';
type StatusFiltro = 'ATIVO' | 'INATIVO' | 'EXPIRADA';
type Periodicidade = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

const PERIODICIDADE_LABEL: Record<Periodicidade, string> = {
  MENSAL: 'Mensal',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};

// ADR-040 — aliquotaPct ampliado para Decimal(9,4) (reaproveitado também como índice de
// reajuste, UC04.02). Exibe só as casas decimais que carregam informação: tributos comuns
// (2 casas, ex. 9,25%) não ganham zeros à direita; índices com mais precisão (ex. IPCA
// 4,5125%) aparecem por completo.
function formatarAliquotaPct(valor: string): string {
  const numero = Number(valor);
  const com4Casas = numero.toFixed(4);
  const semZerosFinais = com4Casas.replace(/0+$/, '').replace(/\.$/, '');
  const casasDecimais = semZerosFinais.includes('.') ? semZerosFinais.split('.')[1].length : 0;
  return numero.toFixed(Math.max(casasDecimais, 2));
}

const TIPO_LABEL: Record<TipoIncidencia, string> = {
  CONTRATO: 'Contrato',
  TERMO_DE_PARCERIA: 'Termo de Parceria',
  AMBOS: 'Ambos',
};

const STATUS_BADGE: Record<StatusFiltro, string> = {
  ATIVO: 'bg-green-100 text-green-800',
  INATIVO: 'bg-gray-100 text-gray-600',
  EXPIRADA: 'bg-amber-100 text-amber-800',
};

// Data de calendário local do navegador — nunca toISOString(), que é sempre UTC e à noite no
// Brasil (UTC-3) já representa o dia seguinte.
function dataLocalDeHoje(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

type FormState = {
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
  // Atalho de UX (2026-09-04) — vincular já a uma Proposta (Rateio de Impostos, US-101).
  propostaId: string;
  contaVinculoId: string;
  competenciaVinculo: string;
  valorDeclaradoVinculo: string;
};

const FORM_VAZIO: FormState = {
  nome: '',
  aliquotaPct: '',
  tipoIncidencia: 'AMBOS',
  dataInicioVigencia: dataLocalDeHoje(),
  dataFimVigencia: '',
  limiteMinimoPct: '',
  limiteMaximoPct: '',
  observacao: '',
  contaSinteticaId: '',
  periodicidadeReajuste: 'MENSAL',
  propostaId: '',
  contaVinculoId: '',
  competenciaVinculo: '',
  valorDeclaradoVinculo: '0',
};

// Datas de vigência são calendário puro (sem hora), persistidas como meia-noite UTC.
// `toLocaleDateString` usaria o fuso do navegador e voltaria a data em 1 dia em fusos
// negativos (ex: UTC-3) — além de divergir entre SSR (fuso do servidor) e o client
// (fuso do usuário), causando hydration mismatch. Formatação sempre em UTC, determinística.
function formatarData(iso: string | null) {
  if (!iso) return '—';
  const data = new Date(iso);
  const dia = String(data.getUTCDate()).padStart(2, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getUTCFullYear()}`;
}

/** UC03.39-42 — grid com filtros + modal de criação/edição + confirmação de exclusão. */
export function AliquotaImpostoListPanel({
  aliquotasIniciais,
  opcoesContaSugerida,
  opcoesContaAnalitica,
  opcoesProposta,
  podeCriar,
  podeEditar,
  podeExcluir,
}: {
  aliquotasIniciais: AliquotaImpostoResultado[];
  opcoesContaSugerida: ContaOpcao[];
  /** US-144 (atalho de vínculo) — só contas analíticas, exigido pelo Rateio (ADR-027). */
  opcoesContaAnalitica: ContaOpcao[];
  opcoesProposta: PropostaOpcao[];
  podeCriar: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const [aliquotas, setAliquotas] = useState(aliquotasIniciais);
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoIncidencia | ''>('');
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro | ''>('');
  const [pending, startTransition] = useTransition();

  const [modalAberto, setModalAberto] = useState<'novo' | 'editar' | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoVersion, setEditandoVersion] = useState(0);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [avisoForm, setAvisoForm] = useState<string | null>(null);

  const [confirmandoExclusaoId, setConfirmandoExclusaoId] = useState<string | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const [erroExportacao, setErroExportacao] = useState<string | null>(null);

  function pesquisar() {
    startTransition(async () => {
      const resposta = await listarAliquotasImposto({
        nome: filtroNome.trim() || undefined,
        tipoIncidencia: filtroTipo || undefined,
        status: filtroStatus || undefined,
      });
      if (resposta.sucesso) setAliquotas(resposta.dados);
    });
  }

  function abrirNovo() {
    setForm(FORM_VAZIO);
    setErroForm(null);
    setModalAberto('novo');
  }

  function abrirEdicao(a: AliquotaImpostoResultado) {
    setEditandoId(a.id);
    setEditandoVersion(a.version);
    setForm({
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
      propostaId: '',
      contaVinculoId: '',
      competenciaVinculo: '',
      valorDeclaradoVinculo: '0',
    });
    setErroForm(null);
    setModalAberto('editar');
  }

  function fecharModal() {
    setModalAberto(null);
    setEditandoId(null);
  }

  function salvar() {
    setErroForm(null);
    setAvisoForm(null);
    startTransition(async () => {
      const propostaEscolhida = opcoesProposta.find((p) => p.id === form.propostaId);
      const payload = {
        nome: form.nome,
        aliquotaPct: form.aliquotaPct,
        tipoIncidencia: form.tipoIncidencia,
        dataInicioVigencia: form.dataInicioVigencia,
        dataFimVigencia: form.dataFimVigencia || null,
        limiteMinimoPct: form.limiteMinimoPct || null,
        limiteMaximoPct: form.limiteMaximoPct || null,
        observacao: form.observacao || null,
        contaSinteticaId: form.contaSinteticaId || null,
        periodicidadeReajuste: form.periodicidadeReajuste,
        vinculo:
          propostaEscolhida && form.contaVinculoId
            ? {
                versaoId: propostaEscolhida.versaoVigenteId,
                contaId: form.contaVinculoId,
                competencia: form.competenciaVinculo || propostaEscolhida.dataInicio,
                valorDeclarado: form.valorDeclaradoVinculo || '0',
              }
            : null,
      };
      const resposta =
        modalAberto === 'editar' && editandoId
          ? await editarAliquotaImposto(editandoId, editandoVersion, payload)
          : await cadastrarAliquotaImposto(payload);

      if (!resposta.sucesso) {
        setErroForm(resposta.mensagem);
        return;
      }
      if (resposta.aviso) {
        setAvisoForm(resposta.aviso);
      }
      fecharModal();
      pesquisar();
    });
  }

  function confirmarExclusao() {
    if (!confirmandoExclusaoId) return;
    setErroExclusao(null);
    startTransition(async () => {
      const resposta = await excluirAliquotaImposto(confirmandoExclusaoId);
      if (!resposta.sucesso) {
        setErroExclusao(resposta.mensagem);
        return;
      }
      setConfirmandoExclusaoId(null);
      pesquisar();
    });
  }

  const colunasExport = useMemo(
    () => [
      { chave: 'nome', rotulo: 'Nome do Imposto' },
      { chave: 'aliquotaPct', rotulo: 'Alíquota (%)' },
      { chave: 'tipoIncidencia', rotulo: 'Tipo de Incidência' },
      { chave: 'periodicidadeReajuste', rotulo: 'Periodicidade do Reajuste' },
      { chave: 'dataInicioVigencia', rotulo: 'Início Vigência' },
      { chave: 'dataFimVigencia', rotulo: 'Fim Vigência' },
      { chave: 'status', rotulo: 'Status' },
    ],
    [],
  );

  function subtituloFiltros() {
    const partes = [
      `Nome: ${filtroNome || '(todos)'}`,
      `Tipo de Incidência: ${filtroTipo ? TIPO_LABEL[filtroTipo] : '(todos)'}`,
      `Status: ${filtroStatus || '(todos)'}`,
    ];
    return partes.join(' — ');
  }

  async function exportar(formato: 'PDF' | 'XLSX') {
    setErroExportacao(null);
    try {
      const linhas = aliquotas.map((a) => ({
        nome: a.nome,
        aliquotaPct: `${a.aliquotaPct}%`,
        tipoIncidencia: TIPO_LABEL[a.tipoIncidencia],
        periodicidadeReajuste: PERIODICIDADE_LABEL[a.periodicidadeReajuste],
        dataInicioVigencia: formatarData(a.dataInicioVigencia),
        dataFimVigencia: formatarData(a.dataFimVigencia),
        status: a.status,
      }));
      if (formato === 'PDF') {
        exportarParaPDF({
          nomeArquivo: 'aliquotas-impostos',
          titulo: 'ALÍQUOTAS DE IMPOSTOS',
          subtitulo: subtituloFiltros(),
          colunas: colunasExport,
          linhas,
          rodape: 'ALÍQUOTAS DE IMPOSTOS',
        });
      } else {
        await exportarParaXLSX({ nomeArquivo: 'aliquotas-impostos', titulo: 'ALÍQUOTAS DE IMPOSTOS', colunas: colunasExport, linhas });
      }
    } catch (erro) {
      setErroExportacao(
        `Não foi possível gerar o arquivo ${formato}. ${erro instanceof Error ? erro.message : 'Erro desconhecido.'}`,
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {avisoForm && (
        <div className="flex items-start justify-between gap-3 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <span>{avisoForm}</span>
          <button type="button" onClick={() => setAvisoForm(null)} className="shrink-0 font-medium hover:underline">
            Fechar
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3 rounded border p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Nome do Imposto</label>
          <input
            type="text"
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
            placeholder="Ex: ISS"
            className="rounded border px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tipo de Incidência</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as TipoIncidencia | '')}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="">Todos</option>
            <option value="CONTRATO">Contrato</option>
            <option value="TERMO_DE_PARCERIA">Termo de Parceria</option>
            <option value="AMBOS">Ambos</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as StatusFiltro | '')}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="">Todos</option>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
            <option value="EXPIRADA">Expirada</option>
          </select>
        </div>
        <button
          type="button"
          onClick={pesquisar}
          disabled={pending}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Pesquisar
        </button>
        <button type="button" onClick={() => void exportar('PDF')} className="rounded border px-3 py-1.5 text-sm">
          Exportar PDF
        </button>
        <button type="button" onClick={() => void exportar('XLSX')} className="rounded border px-3 py-1.5 text-sm">
          Exportar XLSX
        </button>
        {erroExportacao && <p className="w-full text-xs text-red-600">{erroExportacao}</p>}
        {podeCriar && (
          <button
            type="button"
            onClick={abrirNovo}
            className="ml-auto rounded bg-green-600 px-3 py-1.5 text-sm text-white"
          >
            + Novo
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium text-gray-600">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Alíquota (%)</th>
              <th className="px-3 py-2">Tipo de Incidência</th>
              <th className="px-3 py-2">Periodicidade</th>
              <th className="px-3 py-2">Início Vigência</th>
              <th className="px-3 py-2">Fim Vigência</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {aliquotas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                  Nenhuma alíquota encontrada para os filtros informados.
                </td>
              </tr>
            ) : (
              aliquotas.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2">{a.nome}</td>
                  <td className="px-3 py-2 tabular-nums">{formatarAliquotaPct(a.aliquotaPct)}%</td>
                  <td className="px-3 py-2">{TIPO_LABEL[a.tipoIncidencia]}</td>
                  <td className="px-3 py-2">{PERIODICIDADE_LABEL[a.periodicidadeReajuste]}</td>
                  <td className="px-3 py-2">{formatarData(a.dataInicioVigencia)}</td>
                  <td className="px-3 py-2">{formatarData(a.dataFimVigencia)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[a.status]}`}>{a.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {podeEditar && (
                        <button type="button" onClick={() => abrirEdicao(a)} className="text-xs text-blue-700 hover:underline">
                          Editar
                        </button>
                      )}
                      {podeExcluir && (
                        <button
                          type="button"
                          onClick={() => setConfirmandoExclusaoId(a.id)}
                          disabled={a.temReferenciaAtiva}
                          title={a.temReferenciaAtiva ? 'Referenciada em Propostas ativas' : undefined}
                          className="text-xs text-red-700 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">{modalAberto === 'editar' ? 'Alterar Alíquota' : 'Cadastrar Alíquota'}</h2>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">Nome do Imposto *</label>
                <input
                  type="text"
                  maxLength={20}
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Alíquota Padrão (%) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.aliquotaPct}
                  onChange={(e) => setForm({ ...form, aliquotaPct: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Tipo de Incidência *</label>
                <select
                  value={form.tipoIncidencia}
                  onChange={(e) => setForm({ ...form, tipoIncidencia: e.target.value as TipoIncidencia })}
                  className="w-full rounded border px-2 py-1 text-sm"
                >
                  <option value="CONTRATO">Contrato</option>
                  <option value="TERMO_DE_PARCERIA">Termo de Parceria</option>
                  <option value="AMBOS">Ambos</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Periodicidade do Reajuste *</label>
                <select
                  value={form.periodicidadeReajuste}
                  onChange={(e) => setForm({ ...form, periodicidadeReajuste: e.target.value as Periodicidade })}
                  className="w-full rounded border px-2 py-1 text-sm"
                >
                  <option value="MENSAL">Mensal</option>
                  <option value="TRIMESTRAL">Trimestral</option>
                  <option value="SEMESTRAL">Semestral</option>
                  <option value="ANUAL">Anual</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Data Início Vigência *</label>
                <input
                  type="date"
                  value={form.dataInicioVigencia}
                  onChange={(e) => setForm({ ...form, dataInicioVigencia: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Data Fim Vigência</label>
                <input
                  type="date"
                  value={form.dataFimVigencia}
                  onChange={(e) => setForm({ ...form, dataFimVigencia: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Limite Mínimo (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.limiteMinimoPct}
                  onChange={(e) => setForm({ ...form, limiteMinimoPct: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Limite Máximo (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.limiteMaximoPct}
                  onChange={(e) => setForm({ ...form, limiteMaximoPct: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Conta Sugerida (opcional — default de UX no rateio, ADR-038 revisão 2026-08-13, qualquer nível)
                </label>
                <SeletorContaAnalitica
                  contas={[{ id: '', label: '— Nenhuma —' }, ...opcoesContaSugerida]}
                  value={form.contaSinteticaId}
                  onChange={(id) => setForm({ ...form, contaSinteticaId: id })}
                  placeholder="Buscar conta sintética por nome ou código..."
                />
              </div>

              <div className="md:col-span-2 rounded border border-dashed border-gray-300 p-3">
                <p className="mb-2 text-xs font-medium text-gray-700">
                  Vincular já a uma Proposta (opcional — cria/atualiza o Rateio de Impostos)
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Proposta</label>
                    <select
                      value={form.propostaId}
                      onChange={(e) => {
                        const p = opcoesProposta.find((x) => x.id === e.target.value);
                        setForm({
                          ...form,
                          propostaId: e.target.value,
                          competenciaVinculo: form.competenciaVinculo || p?.dataInicio || '',
                        });
                      }}
                      className="w-full rounded border px-2 py-1 text-sm"
                    >
                      <option value="">— Nenhuma —</option>
                      {opcoesProposta.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {form.propostaId && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Conta Analítica *</label>
                        <SeletorContaAnalitica
                          contas={opcoesContaAnalitica}
                          value={form.contaVinculoId}
                          onChange={(id) => setForm({ ...form, contaVinculoId: id })}
                          placeholder="Buscar conta analítica por nome ou código..."
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Competência</label>
                        <input
                          type="date"
                          value={form.competenciaVinculo}
                          onChange={(e) => setForm({ ...form, competenciaVinculo: e.target.value })}
                          className="w-full rounded border px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Valor Declarado (R$) — deixe 0,00 para calcular depois em &quot;Gerar Impostos&quot;
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={form.valorDeclaradoVinculo}
                          onChange={(e) => setForm({ ...form, valorDeclaradoVinculo: e.target.value })}
                          placeholder="0,00"
                          className="w-full rounded border px-2 py-1 text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">Observação</label>
                <textarea
                  maxLength={500}
                  value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-sm"
                  rows={2}
                />
              </div>
            </div>

            {erroForm && <p className="mt-3 text-xs text-red-600">{erroForm}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={fecharModal} className="rounded border px-3 py-1.5 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={
                  pending ||
                  !form.nome.trim() ||
                  !form.aliquotaPct.trim() ||
                  !form.dataInicioVigencia ||
                  (!!form.propostaId && !form.contaVinculoId)
                }
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {pending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmandoExclusaoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded bg-white p-6 shadow-lg">
            <p className="text-sm">
              Deseja realmente excluir a alíquota &quot;{aliquotas.find((a) => a.id === confirmandoExclusaoId)?.nome}&quot;? A alíquota
              será inativada e não estará mais disponível para novas Propostas.
            </p>
            {erroExclusao && <p className="mt-2 text-xs text-red-600">{erroExclusao}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmandoExclusaoId(null);
                  setErroExclusao(null);
                }}
                className="rounded border px-3 py-1.5 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExclusao}
                disabled={pending}
                className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {pending ? 'Excluindo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
