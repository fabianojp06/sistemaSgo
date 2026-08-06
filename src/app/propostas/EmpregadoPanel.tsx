'use client';

import { useState, useTransition } from 'react';
import {
  cadastrarEmpregado,
  excluirEmpregado,
  cadastrarQtdeEmpregado,
  excluirQtdeEmpregado,
  type EmpregadoResultado,
  type QtdeEmpregadoResultado,
} from '@/app/plano-contas/actions';

type CargoOpcao = { id: string; label: string };
type EmpregadoListado = EmpregadoResultado & { categoria: 'EMPREGADO' | 'ESTAGIARIO' | 'JOVEM_APRENDIZ' };

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
  onCriado: (resultado: EmpregadoResultado & { categoria: EmpregadoListado['categoria'] }) => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [cargoId, setCargoId] = useState(cargos[0]?.id ?? '');
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<EmpregadoListado['categoria']>('EMPREGADO');
  const [periodoInicio, setPeriodoInicio] = useState(hoje);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (readOnly) return null;
  if (cargos.length === 0) return <p className="text-sm text-gray-500">Nenhum Cargo cadastrado nesta Proposta ainda.</p>;

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await cadastrarEmpregado({ propostaId, cargoId, nome: nome || null, categoria, periodoInicio });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setNome('');
      onCriado({ ...resposta.dados, categoria });
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <h4 className="text-sm font-medium">Novo Empregado</h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
          <label className="mb-1 block text-xs font-medium text-gray-600">Nome (opcional — "A CONTRATAR" se vazio)</label>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
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
      <div>
        <button type="button" onClick={salvar} disabled={pending || !cargoId} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">
          {pending ? 'Salvando...' : 'Cadastrar'}
        </button>
      </div>
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
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (readOnly) return null;

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await cadastrarQtdeEmpregado({ propostaId, periodoInicio, periodoFim, numeroDocumento });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setNumeroDocumento('');
      onCriado(resposta.dados);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <h4 className="text-sm font-medium">Novo Documento de Consolidação (Qtde. Empregado)</h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Período Início</label>
          <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Período Fim</label>
          <input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Número do Documento</label>
          <input type="text" value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div>
        <button
          type="button"
          onClick={salvar}
          disabled={pending || numeroDocumento.trim().length === 0}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Consolidar'}
        </button>
      </div>
    </div>
  );
}

/** US-108/US-113/US-115 — Empregados + Qtde. Empregado (sub-seção da mesma aba, mesmo domínio RH). */
export function EmpregadoPanel({
  propostaId,
  cargos,
  empregadosIniciais,
  qtdeEmpregadosIniciais,
  readOnly,
}: {
  propostaId: string;
  cargos: CargoOpcao[];
  empregadosIniciais: EmpregadoListado[];
  qtdeEmpregadosIniciais: QtdeEmpregadoResultado[];
  readOnly?: boolean;
}) {
  const [empregados, setEmpregados] = useState(empregadosIniciais);
  const [qtdeEmpregados, setQtdeEmpregados] = useState(qtdeEmpregadosIniciais);
  const [pending, startTransition] = useTransition();

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
        <NovoEmpregadoForm propostaId={propostaId} cargos={cargos} readOnly={readOnly} onCriado={(e) => setEmpregados((atual) => [...atual, e])} />
        {empregados.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum Empregado cadastrado.</p>
        ) : (
          <ul className="divide-y rounded border">
            {empregados.map((empregado) => (
              <li key={empregado.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{empregado.nome}</span>{' '}
                  <span className="text-xs text-gray-500">
                    ({LABEL_CATEGORIA[empregado.categoria]} — {empregado.vinculoFuncionalHerdado} — R$ {empregado.custoTotalMensal}/mês)
                  </span>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => excluir(empregado.id)}
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

      <div className="flex flex-col gap-3">
        <h3 className="font-medium">Qtde. Empregado (consolidação)</h3>
        <NovaQtdeEmpregadoForm propostaId={propostaId} readOnly={readOnly} onCriado={(q) => setQtdeEmpregados((atual) => [...atual, q])} />
        {qtdeEmpregados.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum documento de consolidação cadastrado.</p>
        ) : (
          <ul className="divide-y rounded border">
            {qtdeEmpregados.map((qtde) => (
              <li key={qtde.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {qtde.numeroDocumento} — {qtde.quantidadeEmpregados} empregado(s), {qtde.quantidadeEstagiarios} estagiário(s),{' '}
                  {qtde.quantidadeJovemAprendiz} jovem(ns) aprendiz(es)
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
