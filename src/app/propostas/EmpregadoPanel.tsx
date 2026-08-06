'use client';

import { useState, useTransition } from 'react';
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

const LABEL_CATEGORIA: Record<EmpregadoListado['categoria'], string> = {
  EMPREGADO: 'Empregado',
  ESTAGIARIO: 'Estagiário',
  JOVEM_APRENDIZ: 'Jovem Aprendiz',
};

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
    <div className="flex flex-col gap-3 rounded border p-4">
      <h4 className="text-sm font-medium">Novo Empregado</h4>
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

/** Resumo visual: cards de KPI + tabela "Por Cargo" — mesma fonte de dados da árvore, sem cálculo novo. */
function ResumoConsolidacao({
  empregados,
  cargos,
  totalMensal,
  valorTotalConsolidadoMaisRecente,
  totalEmpregadosMaisRecente,
}: {
  empregados: EmpregadoListado[];
  cargos: CargoOpcao[];
  totalMensal: number;
  valorTotalConsolidadoMaisRecente: string | null;
  totalEmpregadosMaisRecente: number | null;
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded border p-4">
          <p className="text-xs text-gray-500">Total de Empregados</p>
          <p className="text-2xl font-semibold">{totalEmpregadosMaisRecente ?? empregados.length}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-xs text-gray-500">Custo Mensal Total</p>
          <p className="text-2xl font-semibold">{formatarMoeda(totalMensal)}/mês</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-xs text-gray-500">Valor Total do Período</p>
          <p className="text-2xl font-semibold">
            {valorTotalConsolidadoMaisRecente ? formatarMoeda(valorTotalConsolidadoMaisRecente) : '—'}
          </p>
        </div>
      </div>

      {linhas.length > 0 && (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-3 py-2 font-medium">Por Cargo</th>
                <th className="px-3 py-2 font-medium">Qtde</th>
                <th className="px-3 py-2 font-medium">R$/mês</th>
                <th className="px-3 py-2 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.cargoId} className="border-b last:border-0">
                  <td className="px-3 py-2">{linha.label}</td>
                  <td className="px-3 py-2">{linha.quantidade}</td>
                  <td className="px-3 py-2">{formatarMoeda(linha.subtotal)}</td>
                  <td className="px-3 py-2">{linha.percentual.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {linhas.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <BarChartHorizontal
            titulo="Custo Mensal por Cargo"
            barras={linhas.map((l) => ({ id: l.cargoId, label: l.label, valor: l.subtotal }))}
            formatarValor={formatarMoeda}
          />
          <BarChartHorizontal
            titulo="Quantidade de Empregados por Cargo"
            barras={linhas.map((l) => ({ id: l.cargoId, label: l.label, valor: l.quantidade }))}
            formatarValor={(v) => String(v)}
          />
        </div>
      )}
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
}: {
  empregados: EmpregadoListado[];
  cargos: CargoOpcao[];
  contaLabelPorId: Map<string, string>;
  readOnly?: boolean;
  pending: boolean;
  onExcluir: (empregadoId: string) => void;
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
    <div className="flex flex-col gap-2 rounded border">
      {[...grupos.entries()].map(([cargoId, empregadosDoCargo]) => {
        const aberto = expandidos.has(cargoId);
        const subtotal = empregadosDoCargo.reduce((soma, e) => soma + Number(e.custoTotalMensal), 0);
        return (
          <div key={cargoId} className="border-b last:border-0">
            <button
              type="button"
              onClick={() => alternarExpandido(cargoId)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <span className="font-medium">
                {aberto ? '▾' : '▸'} {cargoLabelPorId.get(cargoId) ?? 'Cargo não encontrado'}
              </span>
              <span className="text-xs text-gray-500">
                {empregadosDoCargo.length} empregado(s) — {formatarMoeda(subtotal)}/mês
              </span>
            </button>
            {aberto && (
              <ul className="divide-y border-t bg-gray-50">
                {empregadosDoCargo.map((empregado) => (
                  <li key={empregado.id} className="flex items-center justify-between gap-2 px-6 py-2 text-sm">
                    <div>
                      <span className="font-medium">{empregado.nome}</span>{' '}
                      <span className="text-xs text-gray-500">
                        ({LABEL_CATEGORIA[empregado.categoria]} — {empregado.vinculoFuncionalHerdado} — {formatarMoeda(empregado.custoTotalMensal)}/mês —{' '}
                        {contaLabelPorId.get(empregado.contaId) ?? 'Conta não encontrada'})
                      </span>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => onExcluir(empregado.id)}
                        disabled={pending}
                        className="rounded border px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    )}
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
    <div className="flex flex-col gap-3 rounded border p-4">
      <h4 className="text-sm font-medium">Novo Documento de Consolidação (Qtde. Empregado)</h4>
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="font-medium">Empregados</h3>
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
          />
        )}
        {empregados.length > 0 && (
          <p className="text-xs text-gray-500">Reflete na guia Semáforo (Valor Realizado por conta) — resumo completo abaixo, em Qtde. Empregado.</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-medium">Qtde. Empregado (Consolidação — somente leitura, gerada a partir dos Empregados lançados acima)</h3>
        <p className="text-xs text-gray-500">
          Este documento resume, por período, quantos Empregados/Estagiários/Jovens Aprendizes ativos existem nesta Proposta. O
          lançamento de vagas/pessoas fica na seção Empregados, acima — os totais abaixo são calculados automaticamente, não digitados.
        </p>
        <ResumoConsolidacao
          empregados={empregados}
          cargos={cargos}
          totalMensal={totalMensal}
          // Documento mais recente = último do array (não há ordenação explícita hoje; ver excluirDocumento acima).
          valorTotalConsolidadoMaisRecente={qtdeEmpregados.at(-1)?.valorTotalConsolidado ?? null}
          totalEmpregadosMaisRecente={qtdeEmpregados.at(-1)?.quantidadeEmpregados ?? null}
        />
        <NovaQtdeEmpregadoForm propostaId={propostaId} readOnly={readOnly} onCriado={(q) => setQtdeEmpregados((atual) => [...atual, q])} />
        {qtdeEmpregados.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum documento de consolidação cadastrado.</p>
        ) : (
          <ul className="divide-y rounded border">
            {qtdeEmpregados.map((qtde) => (
              <li key={qtde.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {qtde.numeroDocumento} — {qtde.quantidadeEmpregados} empregado(s), {qtde.quantidadeEstagiarios} estagiário(s),{' '}
                  {qtde.quantidadeJovemAprendiz} jovem(ns) aprendiz(es) — Valor Total do Período: {formatarMoeda(qtde.valorTotalConsolidado)}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => excluirDocumento(qtde.id)}
                    disabled={pending}
                    className="rounded border px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                  >
                    Excluir
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
