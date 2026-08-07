'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  cadastrarEmpregado,
  cadastrarEmpregadosEmLote,
  excluirEmpregado,
  cadastrarQtdeEmpregado,
  excluirQtdeEmpregado,
  type EmpregadoResultado,
  type QtdeEmpregadoResultado,
} from '@/app/plano-contas/actions';
import { BarChartHorizontal } from './BarChartHorizontal';

type CargoOpcao = { id: string; label: string };
type EmpregadoListado = EmpregadoResultado & { categoria: 'EMPREGADO' | 'ESTAGIARIO' | 'JOVEM_APRENDIZ' };

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: number | string): string {
  return formatadorMoeda.format(Number(valor));
}

// Paleta categórica validada pela skill dataviz — ordem fixa (mecanismo de segurança
// para daltonismo, não embaralhar). Ciclo de 8 hues, repete além disso via módulo.
const PALETA_CATEGORICA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
function corPorCargo(cargoId: string, cargos: CargoOpcao[]): string {
  const indice = cargos.findIndex((c) => c.id === cargoId);
  return PALETA_CATEGORICA[(indice < 0 ? 0 : indice) % PALETA_CATEGORICA.length];
}

const LABEL_CATEGORIA: Record<EmpregadoListado['categoria'], string> = {
  EMPREGADO: 'Empregado',
  ESTAGIARIO: 'Estagiário',
  JOVEM_APRENDIZ: 'Jovem Aprendiz',
};

type ChaveSnapshotCusto =
  | 'valorSalarioSnapshot'
  | 'valorGratificacaoSnapshot'
  | 'valorEncargosSociaisSnapshot'
  | 'valorValeAlimentacaoSnapshot'
  | 'valorValeRefeicaoSnapshot'
  | 'valorValeTransporteSnapshot'
  | 'valorPlanoSaudeSnapshot'
  | 'valorPlanoOdontologicoSnapshot'
  | 'valorSeguroVidaSnapshot'
  | 'valorAuxilioCrecheSnapshot';

// ADR-029 — rótulo de cada componente de custo, na mesma ordem exibida no modal de Detalhes.
const LABEL_COMPONENTE_CUSTO: { chave: ChaveSnapshotCusto; label: string }[] = [
  { chave: 'valorSalarioSnapshot', label: 'Salário Base' },
  { chave: 'valorGratificacaoSnapshot', label: 'Gratificação' },
  { chave: 'valorEncargosSociaisSnapshot', label: 'Encargos Sociais' },
  { chave: 'valorValeAlimentacaoSnapshot', label: 'Vale Alimentação' },
  { chave: 'valorValeRefeicaoSnapshot', label: 'Vale Refeição' },
  { chave: 'valorValeTransporteSnapshot', label: 'Vale Transporte' },
  { chave: 'valorPlanoSaudeSnapshot', label: 'Plano de Saúde' },
  { chave: 'valorPlanoOdontologicoSnapshot', label: 'Plano Odontológico' },
  { chave: 'valorSeguroVidaSnapshot', label: 'Seguro de Vida' },
  { chave: 'valorAuxilioCrecheSnapshot', label: 'Auxílio-Creche' },
];

/** Modal "Detalhes" — lista os componentes de custo (benefícios) de um Empregado, só os com valor > 0. */
function ModalDetalhesEmpregado({ empregado, onFechar }: { empregado: EmpregadoListado; onFechar: () => void }) {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const linhas = LABEL_COMPONENTE_CUSTO.map(({ chave, label }) => ({ label, valor: Number(empregado[chave]) })).filter(
    (linha) => linha.valor > 0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes de ${empregado.nome}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
          <h4 className="text-sm font-semibold text-slate-800">Detalhes — {empregado.nome}</h4>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="text-lg leading-none text-gray-400 hover:text-gray-700">
            &times;
          </button>
        </div>
        <div className="overflow-y-auto">
          {linhas.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">Nenhum benefício com valor lançado para este Empregado.</p>
          ) : (
            <ul className="divide-y">
              {linhas.map((linha) => (
                <li key={linha.label} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="text-slate-700">{linha.label}</span>
                  <span className="tabular-nums font-medium text-slate-800">{formatarMoeda(linha.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t bg-slate-50 px-4 py-2.5 text-right">
          <button type="button" onClick={onFechar} className="rounded border px-3 py-1.5 text-sm text-slate-700 hover:bg-white">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// Ícones minimalistas inline — sem dependência de biblioteca de ícones (não instalada no projeto).
function IconePessoas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
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
function IconeCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

/** Faixa executiva (dashboard financeiro) com os 3 KPIs principais da tela. */
function ResumoExecutivo({
  totalEmpregados,
  totalMensal,
  valorTotalConsolidadoMaisRecente,
}: {
  totalEmpregados: number;
  totalMensal: number;
  valorTotalConsolidadoMaisRecente: string | null;
}) {
  const kpis = [
    { icone: <IconePessoas />, label: 'Total de Empregados', valor: String(totalEmpregados) },
    { icone: <IconeMoeda />, label: 'Custo Mensal Total', valor: `${formatarMoeda(totalMensal)}/mês` },
    {
      icone: <IconeCalendario />,
      label: 'Valor Total do Período',
      valor: valorTotalConsolidadoMaisRecente ? formatarMoeda(valorTotalConsolidadoMaisRecente) : '—',
    },
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

function NovoEmpregadoForm({
  propostaId,
  cargos,
  readOnly,
  onCriado,
}: {
  propostaId: string;
  cargos: CargoOpcao[];
  readOnly?: boolean;
  onCriado: (resultados: (EmpregadoResultado & { categoria: EmpregadoListado['categoria'] })[]) => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [cargoId, setCargoId] = useState(cargos[0]?.id ?? '');
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [categoria, setCategoria] = useState<EmpregadoListado['categoria']>('EMPREGADO');
  const [periodoInicio, setPeriodoInicio] = useState(hoje);
  const [erro, setErro] = useState<string | null>(null);
  const [totalLote, setTotalLote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (readOnly) return null;
  if (cargos.length === 0) return <p className="text-sm text-gray-500">Nenhum Cargo cadastrado nesta Proposta ainda.</p>;

  const temNome = nome.trim().length > 0;

  function salvar() {
    setErro(null);
    setTotalLote(null);
    startTransition(async () => {
      // US-108b — nome preenchido é sempre 1 pessoa nomeada; quantidade > 1 só
      // faz sentido para vagas "A CONTRATAR" (RN0249), lançadas em lote.
      if (temNome) {
        const resposta = await cadastrarEmpregado({ propostaId, cargoId, nome, categoria, periodoInicio });
        if (!resposta.sucesso) {
          setErro(resposta.mensagem);
          return;
        }
        setNome('');
        onCriado([{ ...resposta.dados, categoria }]);
        return;
      }

      const resposta = await cadastrarEmpregadosEmLote({
        propostaId,
        cargoId,
        quantidade: Number(quantidade),
        categoria,
        periodoInicio,
      });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setTotalLote(resposta.dados.totalLote);
      onCriado(resposta.dados.empregados.map((e) => ({ ...e, categoria })));
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm md:p-5">
      <h4 className="text-sm font-semibold text-slate-800">Novo Empregado</h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Cargo</label>
          <select value={cargoId} onChange={(e) => setCargoId(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Nome (opcional — &quot;A CONTRATAR&quot; se vazio)</label>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Quantidade</label>
          <input
            type="number"
            min={1}
            step={1}
            value={temNome ? '1' : quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            disabled={temNome}
            className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Categoria</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as EmpregadoListado['categoria'])} className="w-full rounded border px-2 py-1 text-sm">
            <option value="EMPREGADO">Empregado</option>
            <option value="ESTAGIARIO">Estagiário</option>
            <option value="JOVEM_APRENDIZ">Jovem Aprendiz</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Período Início</label>
          <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {totalLote && <p className="text-xs text-gray-500">Total do lote: {formatarMoeda(totalLote)}/mês</p>}
      <div>
        <button
          type="button"
          onClick={salvar}
          disabled={pending || !cargoId || (!temNome && (!Number.isInteger(Number(quantidade)) || Number(quantidade) <= 0))}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Cadastrar'}
        </button>
      </div>
    </div>
  );
}

/** Agrupamento compartilhado — usado pela árvore e pela tabela "Por Cargo" do resumo visual. */
function agruparPorCargo(empregados: EmpregadoListado[]): Map<string, EmpregadoListado[]> {
  const grupos = new Map<string, EmpregadoListado[]>();
  for (const empregado of empregados) {
    const grupo = grupos.get(empregado.cargoId) ?? [];
    grupo.push(empregado);
    grupos.set(empregado.cargoId, grupo);
  }
  return grupos;
}

/** Resumo visual: tabela + gráficos "Por Cargo" — mesma fonte de dados da árvore, sem cálculo novo. */
function ResumoConsolidacao({
  empregados,
  cargos,
  totalMensal,
}: {
  empregados: EmpregadoListado[];
  cargos: CargoOpcao[];
  totalMensal: number;
}) {
  const cargoLabelPorId = new Map(cargos.map((c) => [c.id, c.label]));
  const grupos = agruparPorCargo(empregados);
  const linhas = [...grupos.entries()].map(([cargoId, empregadosDoCargo]) => {
    const subtotal = empregadosDoCargo.reduce((soma, e) => soma + Number(e.custoTotalMensal), 0);
    return {
      cargoId,
      label: cargoLabelPorId.get(cargoId) ?? 'Cargo não encontrado',
      quantidade: empregadosDoCargo.length,
      subtotal,
      percentual: totalMensal > 0 ? (subtotal / totalMensal) * 100 : 0,
    };
  });

  if (linhas.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs text-gray-500">
              <th className="px-4 py-2.5 font-medium">Por Cargo</th>
              <th className="px-4 py-2.5 font-medium">Qtde</th>
              <th className="px-4 py-2.5 font-medium">R$/mês</th>
              <th className="px-4 py-2.5 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.cargoId} className="border-b last:border-0 hover:bg-slate-100">
                <td className="px-4 py-2.5">{linha.label}</td>
                <td className="px-4 py-2.5 tabular-nums">{linha.quantidade}</td>
                <td className="px-4 py-2.5 tabular-nums">{formatarMoeda(linha.subtotal)}</td>
                <td className="px-4 py-2.5 tabular-nums">{linha.percentual.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <BarChartHorizontal
          titulo="Custo Mensal por Cargo"
          barras={linhas.map((l) => ({ id: l.cargoId, label: l.label, valor: l.subtotal, cor: corPorCargo(l.cargoId, cargos) }))}
          formatarValor={formatarMoeda}
        />
        <BarChartHorizontal
          titulo="Quantidade de Empregados por Cargo"
          barras={linhas.map((l) => ({ id: l.cargoId, label: l.label, valor: l.quantidade, cor: corPorCargo(l.cargoId, cargos) }))}
          formatarValor={(v) => String(v)}
        />
      </div>
    </div>
  );
}

/** Agrupador em árvore: 1 nó por Cargo, desmembrável para ver os Empregados daquele Cargo. */
function EmpregadosPorCargoArvore({
  empregados,
  cargos,
  contaLabelPorId,
  readOnly,
  pending,
  onExcluir,
  onVerDetalhes,
}: {
  empregados: EmpregadoListado[];
  cargos: CargoOpcao[];
  contaLabelPorId: Map<string, string>;
  readOnly?: boolean;
  pending: boolean;
  onExcluir: (empregadoId: string) => void;
  onVerDetalhes: (empregado: EmpregadoListado) => void;
}) {
  const cargoLabelPorId = new Map(cargos.map((c) => [c.id, c.label]));
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const grupos = agruparPorCargo(empregados);

  function alternarExpandido(cargoId: string) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(cargoId)) novo.delete(cargoId);
      else novo.add(cargoId);
      return novo;
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
      {[...grupos.entries()].map(([cargoId, empregadosDoCargo]) => {
        const aberto = expandidos.has(cargoId);
        const subtotal = empregadosDoCargo.reduce((soma, e) => soma + Number(e.custoTotalMensal), 0);
        return (
          <div key={cargoId} className="border-b last:border-0">
            <button
              type="button"
              onClick={() => alternarExpandido(cargoId)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-100"
            >
              <span className="font-medium text-slate-800">
                <span className="mr-1.5 inline-block text-slate-400">{aberto ? '▾' : '▸'}</span>
                {cargoLabelPorId.get(cargoId) ?? 'Cargo não encontrado'}
              </span>
              <span className="text-xs tabular-nums text-gray-500">
                {empregadosDoCargo.length} empregado(s) — {formatarMoeda(subtotal)}/mês
              </span>
            </button>
            {aberto && (
              <ul className="divide-y border-t bg-slate-50/60">
                {empregadosDoCargo.map((empregado) => (
                  <li key={empregado.id} className="flex items-center justify-between gap-2 px-8 py-2.5 text-sm">
                    <div>
                      <span className="font-medium">{empregado.nome}</span>{' '}
                      <span className="text-xs text-gray-500">
                        ({LABEL_CATEGORIA[empregado.categoria]} — {empregado.vinculoFuncionalHerdado} — {formatarMoeda(empregado.custoTotalMensal)}/mês —{' '}
                        {contaLabelPorId.get(empregado.contaId) ?? 'Conta não encontrada'})
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onVerDetalhes(empregado)}
                        className="rounded-md border border-gray-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Detalhes
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => onExcluir(empregado.id)}
                          disabled={pending}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NovaQtdeEmpregadoForm({
  propostaId,
  readOnly,
  onCriado,
}: {
  propostaId: string;
  readOnly?: boolean;
  onCriado: (resultado: QtdeEmpregadoResultado) => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [periodoInicio, setPeriodoInicio] = useState(hoje);
  const [periodoFim, setPeriodoFim] = useState(hoje);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (readOnly) return null;

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await cadastrarQtdeEmpregado({ propostaId, periodoInicio, periodoFim });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      onCriado(resposta.dados);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm md:p-5">
      <h4 className="text-sm font-semibold text-slate-800">Novo Documento de Consolidação (Qtde. Empregado)</h4>
      <p className="text-xs text-gray-500">O Número do Documento é gerado automaticamente (formato C-XXX, sequencial por Proposta).</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Período Início</label>
          <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Período Fim</label>
          <input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div>
        <button
          type="button"
          onClick={salvar}
          disabled={pending}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Consolidar'}
        </button>
      </div>
    </div>
  );
}

/** US-108/US-113/US-113b/US-115 — Empregados + Qtde. Empregado (sub-seção da mesma aba, mesmo domínio RH). */
export function EmpregadoPanel({
  propostaId,
  cargos,
  empregadosIniciais,
  qtdeEmpregadosIniciais,
  contasAnaliticas,
  readOnly,
}: {
  propostaId: string;
  cargos: CargoOpcao[];
  empregadosIniciais: EmpregadoListado[];
  qtdeEmpregadosIniciais: QtdeEmpregadoResultado[];
  contasAnaliticas: { id: string; label: string }[];
  readOnly?: boolean;
}) {
  const [empregados, setEmpregados] = useState(empregadosIniciais);
  const [qtdeEmpregados, setQtdeEmpregados] = useState(qtdeEmpregadosIniciais);
  const [pending, startTransition] = useTransition();
  const [empregadoDetalhes, setEmpregadoDetalhes] = useState<EmpregadoListado | null>(null);

  const contaLabelPorId = new Map(contasAnaliticas.map((c) => [c.id, c.label]));
  // Item 2 do feedback de teste HML — total mensal corrente lançado (sem multiplicar por
  // duração; distinto de valorTotalConsolidado, que é o total do período de um documento).
  const totalMensal = empregados.reduce((soma, e) => soma + Number(e.custoTotalMensal), 0);

  function excluir(empregadoId: string) {
    startTransition(async () => {
      const resposta = await excluirEmpregado(empregadoId);
      if (resposta.sucesso) setEmpregados((atual) => atual.filter((e) => e.id !== empregadoId));
    });
  }

  function excluirDocumento(qtdeEmpregadoId: string) {
    startTransition(async () => {
      const resposta = await excluirQtdeEmpregado(qtdeEmpregadoId);
      if (resposta.sucesso) setQtdeEmpregados((atual) => atual.filter((q) => q.id !== qtdeEmpregadoId));
    });
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-slate-50 p-4 md:p-6">
      <ResumoExecutivo
        totalEmpregados={qtdeEmpregados.at(-1)?.quantidadeEmpregados ?? empregados.length}
        totalMensal={totalMensal}
        // Documento mais recente = último do array (não há ordenação explícita hoje; ver excluirDocumento abaixo).
        valorTotalConsolidadoMaisRecente={qtdeEmpregados.at(-1)?.valorTotalConsolidado ?? null}
      />

      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800">
          <span className="text-slate-400">
            <IconePessoas />
          </span>
          Empregados
        </h3>
        <NovoEmpregadoForm
          propostaId={propostaId}
          cargos={cargos}
          readOnly={readOnly}
          onCriado={(novos) => setEmpregados((atual) => [...atual, ...novos])}
        />
        {empregados.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum Empregado cadastrado.</p>
        ) : (
          <EmpregadosPorCargoArvore
            empregados={empregados}
            cargos={cargos}
            contaLabelPorId={contaLabelPorId}
            readOnly={readOnly}
            pending={pending}
            onExcluir={excluir}
            onVerDetalhes={setEmpregadoDetalhes}
          />
        )}
        {empregados.length > 0 && (
          <p className="text-xs text-gray-500">Reflete na guia Semáforo (Valor Realizado por conta) — resumo completo abaixo, em Qtde. Empregado.</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800">
          <span className="text-slate-400">
            <IconeCalendario />
          </span>
          Qtde. Empregado (Consolidação — somente leitura, gerada a partir dos Empregados lançados acima)
        </h3>
        <p className="text-xs text-gray-500">
          Este documento resume, por período, quantos Empregados/Estagiários/Jovens Aprendizes ativos existem nesta Proposta. O
          lançamento de vagas/pessoas fica na seção Empregados, acima — os totais abaixo são calculados automaticamente, não digitados.
        </p>
        <ResumoConsolidacao empregados={empregados} cargos={cargos} totalMensal={totalMensal} />
        <NovaQtdeEmpregadoForm propostaId={propostaId} readOnly={readOnly} onCriado={(q) => setQtdeEmpregados((atual) => [...atual, q])} />
        {qtdeEmpregados.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum documento de consolidação cadastrado.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
            {qtdeEmpregados.map((qtde) => (
              <li key={qtde.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-slate-100">
                <span className="tabular-nums">
                  <span className="font-medium text-slate-800">{qtde.numeroDocumento}</span> — {qtde.quantidadeEmpregados} empregado(s),{' '}
                  {qtde.quantidadeEstagiarios} estagiário(s), {qtde.quantidadeJovemAprendiz} jovem(ns) aprendiz(es) — Valor Total do
                  Período: {formatarMoeda(qtde.valorTotalConsolidado)}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => excluirDocumento(qtde.id)}
                    disabled={pending}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Excluir
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {empregadoDetalhes && <ModalDetalhesEmpregado empregado={empregadoDetalhes} onFechar={() => setEmpregadoDetalhes(null)} />}
    </div>
  );
}
