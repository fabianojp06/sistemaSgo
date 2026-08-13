'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  listarSenioridades,
  cadastrarSenioridade,
  excluirSenioridade,
  listarTabelaSalarial,
  cadastrarTabelaSalarial,
  editarTabelaSalarial,
  excluirTabelaSalarial,
  type SenioridadeResultado,
  type TabelaSalarialResultado,
} from './estrutura-actions';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: string): string {
  return formatadorMoeda.format(Number(valor));
}

type Props = {
  cargoId: string;
  cargoNome: string;
  onFechar: () => void;
};

/**
 * US-131, seção 5 — Tabela Salarial de mercado (Cadastro + Consulta), acionada pelo botão
 * "Tabela Salarial" na tela de Cargos. RN_TAB_03: exibe TODOS os registros do Cargo,
 * agrupados por Senioridade. Preenchimento automático dos campos de Mín/Máx do Cargo a
 * partir de uma faixa selecionada é escopo de US-133 (ainda não implementado) — aqui só
 * o CRUD e a consulta.
 */
export function TabelaSalarialModal({ cargoId, cargoNome, onFechar }: Props) {
  const [senioridades, setSenioridades] = useState<SenioridadeResultado[]>([]);
  const [registros, setRegistros] = useState<TabelaSalarialResultado[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, startCarregando] = useTransition();
  const [salvando, startSalvando] = useTransition();

  const [novaSenioridade, setNovaSenioridade] = useState('');
  const [form, setForm] = useState({ senioridadeId: '', salarioMinimo: '', salarioMaximo: '' });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formEdicao, setFormEdicao] = useState({ salarioMinimo: '', salarioMaximo: '' });

  function carregar() {
    startCarregando(async () => {
      const [respSenioridades, respRegistros] = await Promise.all([listarSenioridades(), listarTabelaSalarial(cargoId)]);
      if (respSenioridades.sucesso) {
        setSenioridades(respSenioridades.dados);
        setForm((f) => ({ ...f, senioridadeId: f.senioridadeId || respSenioridades.dados[0]?.id || '' }));
      } else {
        setErro(respSenioridades.mensagem);
      }
      if (respRegistros.sucesso) {
        setRegistros(respRegistros.dados);
      } else {
        setErro(respRegistros.mensagem);
      }
    });
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargoId]);

  function agrupadoPorSenioridade() {
    const grupos = new Map<string, TabelaSalarialResultado[]>();
    for (const r of registros) {
      const lista = grupos.get(r.senioridadeDescricao) ?? [];
      lista.push(r);
      grupos.set(r.senioridadeDescricao, lista);
    }
    return Array.from(grupos.entries());
  }

  function handleCadastrarSenioridade() {
    if (!novaSenioridade.trim()) return;
    setErro(null);
    startSalvando(async () => {
      const resposta = await cadastrarSenioridade({ descricao: novaSenioridade.trim() });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setNovaSenioridade('');
      carregar();
    });
  }

  function handleExcluirSenioridade(senioridadeId: string) {
    setErro(null);
    startSalvando(async () => {
      const resposta = await excluirSenioridade(senioridadeId);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      carregar();
    });
  }

  function handleCadastrarFaixa() {
    if (!form.senioridadeId || !form.salarioMinimo || !form.salarioMaximo) {
      setErro('Preencha Senioridade, Salário Mínimo e Salário Máximo.');
      return;
    }
    setErro(null);
    startSalvando(async () => {
      const resposta = await cadastrarTabelaSalarial({ cargoId, ...form });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setForm((f) => ({ ...f, salarioMinimo: '', salarioMaximo: '' }));
      carregar();
    });
  }

  function iniciarEdicao(registro: TabelaSalarialResultado) {
    setEditandoId(registro.id);
    setFormEdicao({ salarioMinimo: registro.salarioMinimo, salarioMaximo: registro.salarioMaximo });
  }

  function handleSalvarEdicao() {
    if (!editandoId) return;
    setErro(null);
    startSalvando(async () => {
      const resposta = await editarTabelaSalarial(editandoId, formEdicao);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setEditandoId(null);
      carregar();
    });
  }

  function handleExcluirFaixa(id: string) {
    setErro(null);
    startSalvando(async () => {
      const resposta = await excluirTabelaSalarial(id);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      carregar();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Tabela Salarial — {cargoNome}</h3>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {erro && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}

          <section className="mb-4 rounded-lg border border-gray-100 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium text-gray-600">Senioridade</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {senioridades.map((s) => (
                <span key={s.id} className="flex items-center gap-1 rounded-full border bg-white px-2 py-1 text-xs text-slate-700">
                  {s.descricao}
                  {!s.isPadrao && (
                    <button
                      type="button"
                      onClick={() => handleExcluirSenioridade(s.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Excluir Senioridade"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={novaSenioridade}
                onChange={(e) => setNovaSenioridade(e.target.value)}
                placeholder="Nova senioridade (ex: Especialista)"
                className="flex-1 rounded border px-2 py-1 text-sm"
              />
              <button
                type="button"
                disabled={salvando}
                onClick={handleCadastrarSenioridade}
                className="rounded-md bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                + Adicionar
              </button>
            </div>
          </section>

          <section className="mb-4 rounded-lg border border-gray-100 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium text-gray-600">Nova faixa de mercado</p>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={form.senioridadeId}
                onChange={(e) => setForm((f) => ({ ...f, senioridadeId: e.target.value }))}
                className="rounded border px-2 py-1 text-sm"
              >
                {senioridades.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.descricao}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Salário Mínimo"
                value={form.salarioMinimo}
                onChange={(e) => setForm((f) => ({ ...f, salarioMinimo: e.target.value }))}
                className="rounded border px-2 py-1 text-sm"
              />
              <input
                type="number"
                placeholder="Salário Máximo"
                value={form.salarioMaximo}
                onChange={(e) => setForm((f) => ({ ...f, salarioMaximo: e.target.value }))}
                className="rounded border px-2 py-1 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={salvando}
              onClick={handleCadastrarFaixa}
              className="mt-2 rounded-md bg-blue-700 px-3 py-1 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              Cadastrar faixa
            </button>
          </section>

          <section>
            <p className="mb-2 text-xs font-medium text-gray-600">Faixas cadastradas</p>
            {carregando && <p className="text-xs text-gray-400">Carregando…</p>}
            {!carregando && registros.length === 0 && <p className="text-xs text-gray-400">Nenhuma faixa cadastrada para este Cargo.</p>}
            <div className="flex flex-col gap-3">
              {agrupadoPorSenioridade().map(([senioridadeDescricao, lista]) => (
                <div key={senioridadeDescricao}>
                  <p className="mb-1 text-xs font-semibold text-slate-600">{senioridadeDescricao}</p>
                  <div className="flex flex-col gap-1">
                    {lista.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded border border-gray-100 bg-white px-3 py-2 text-sm">
                        {editandoId === r.id ? (
                          <div className="flex flex-1 items-center gap-2">
                            <input
                              type="number"
                              value={formEdicao.salarioMinimo}
                              onChange={(e) => setFormEdicao((f) => ({ ...f, salarioMinimo: e.target.value }))}
                              className="w-28 rounded border px-2 py-1 text-xs"
                            />
                            <span className="text-gray-400">—</span>
                            <input
                              type="number"
                              value={formEdicao.salarioMaximo}
                              onChange={(e) => setFormEdicao((f) => ({ ...f, salarioMaximo: e.target.value }))}
                              className="w-28 rounded border px-2 py-1 text-xs"
                            />
                            <button type="button" onClick={handleSalvarEdicao} className="text-xs text-blue-700 hover:underline">
                              Salvar
                            </button>
                            <button type="button" onClick={() => setEditandoId(null)} className="text-xs text-gray-500 hover:underline">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <>
                            <span>
                              {formatarMoeda(r.salarioMinimo)} — {formatarMoeda(r.salarioMaximo)}
                            </span>
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={() => iniciarEdicao(r)} className="text-xs text-blue-700 hover:underline">
                                Editar
                              </button>
                              <button type="button" onClick={() => handleExcluirFaixa(r.id)} className="text-xs text-red-600 hover:underline">
                                Excluir
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex justify-end border-t px-5 py-3">
          <button type="button" onClick={onFechar} className="rounded-md border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
