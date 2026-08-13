'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  cadastrarSenioridade,
  excluirSenioridade,
  listarTodaTabelaSalarial,
  cadastrarTabelaSalarial,
  editarTabelaSalarial,
  excluirTabelaSalarial,
  type SenioridadeResultado,
  type TabelaSalarialResultado,
} from '../propostas/estrutura-actions';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: string): string {
  return formatadorMoeda.format(Number(valor));
}

type Props = {
  registrosIniciais: TabelaSalarialResultado[];
  senioridadesIniciais: SenioridadeResultado[];
  opcoesCargo: { id: string; label: string }[];
  podeGerenciar: boolean;
};

/**
 * US-131 (melhoria de visualização, 2026-08-13) — tela própria da Tabela Salarial: tabela
 * plana com filtros por Cargo/Senioridade, mais fácil de trabalhar do que o modal por Cargo
 * (que continua existindo em CargoPanel.tsx como um seletor rápido, não CRUD completo).
 */
export function TabelaSalarialListPanel({ registrosIniciais, senioridadesIniciais, opcoesCargo, podeGerenciar }: Props) {
  const [registros, setRegistros] = useState(registrosIniciais);
  const [senioridades, setSenioridades] = useState(senioridadesIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [, startAtualizando] = useTransition();
  const [salvando, startSalvando] = useTransition();

  const [filtroCargoId, setFiltroCargoId] = useState('TODOS');
  const [filtroSenioridadeId, setFiltroSenioridadeId] = useState('TODAS');

  const [novaSenioridade, setNovaSenioridade] = useState('');
  const [form, setForm] = useState({ cargoId: '', senioridadeId: senioridadesIniciais[0]?.id ?? '', salarioMinimo: '', salarioMaximo: '' });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formEdicao, setFormEdicao] = useState({ salarioMinimo: '', salarioMaximo: '' });

  const registrosFiltrados = useMemo(
    () =>
      registros.filter(
        (r) => (filtroCargoId === 'TODOS' || r.cargoId === filtroCargoId) && (filtroSenioridadeId === 'TODAS' || r.senioridadeId === filtroSenioridadeId),
      ),
    [registros, filtroCargoId, filtroSenioridadeId],
  );

  function recarregar() {
    startAtualizando(async () => {
      const resposta = await listarTodaTabelaSalarial();
      if (resposta.sucesso) setRegistros(resposta.dados);
    });
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
      setSenioridades((s) => [...s, resposta.dados]);
      setNovaSenioridade('');
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
      setSenioridades((s) => s.filter((x) => x.id !== senioridadeId));
    });
  }

  function handleCadastrarFaixa() {
    if (!form.cargoId || !form.senioridadeId || !form.salarioMinimo || !form.salarioMaximo) {
      setErro('Preencha Cargo, Senioridade, Salário Mínimo e Salário Máximo.');
      return;
    }
    setErro(null);
    startSalvando(async () => {
      const resposta = await cadastrarTabelaSalarial(form);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setForm((f) => ({ ...f, salarioMinimo: '', salarioMaximo: '' }));
      recarregar();
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
      recarregar();
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
      recarregar();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-medium text-gray-700">Senioridade</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {senioridades.map((s) => (
            <span key={s.id} className="flex items-center gap-1 rounded-full border bg-slate-50 px-3 py-1 text-sm text-slate-700">
              {s.descricao}
              {!s.isPadrao && podeGerenciar && (
                <button type="button" onClick={() => handleExcluirSenioridade(s.id)} className="text-red-500 hover:text-red-700" title="Excluir">
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
        {podeGerenciar && (
          <div className="flex gap-2">
            <input
              type="text"
              value={novaSenioridade}
              onChange={(e) => setNovaSenioridade(e.target.value)}
              placeholder="Nova senioridade (ex: Especialista)"
              className="flex-1 rounded border px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={salvando}
              onClick={handleCadastrarSenioridade}
              className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              + Adicionar
            </button>
          </div>
        )}
      </section>

      {podeGerenciar && (
        <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium text-gray-700">Cadastrar nova faixa de mercado</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <select value={form.cargoId} onChange={(e) => setForm((f) => ({ ...f, cargoId: e.target.value }))} className="rounded border px-2 py-1.5 text-sm">
              <option value="">Selecione o Cargo</option>
              {opcoesCargo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={form.senioridadeId}
              onChange={(e) => setForm((f) => ({ ...f, senioridadeId: e.target.value }))}
              className="rounded border px-2 py-1.5 text-sm"
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
              className="rounded border px-2 py-1.5 text-sm"
            />
            <input
              type="number"
              placeholder="Salário Máximo"
              value={form.salarioMaximo}
              onChange={(e) => setForm((f) => ({ ...f, salarioMaximo: e.target.value }))}
              className="rounded border px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={salvando}
            onClick={handleCadastrarFaixa}
            className="mt-2 rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            Cadastrar faixa
          </button>
        </section>
      )}

      <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-gray-700">Faixas cadastradas ({registrosFiltrados.length})</p>
          <div className="ml-auto flex gap-2">
            <select value={filtroCargoId} onChange={(e) => setFiltroCargoId(e.target.value)} className="rounded border px-2 py-1 text-xs">
              <option value="TODOS">Todos os Cargos</option>
              {opcoesCargo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select value={filtroSenioridadeId} onChange={(e) => setFiltroSenioridadeId(e.target.value)} className="rounded border px-2 py-1 text-xs">
              <option value="TODAS">Todas as Senioridades</option>
              {senioridades.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.descricao}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2">Cargo</th>
                <th className="px-3 py-2">Senioridade</th>
                <th className="px-3 py-2 text-right">Salário Mínimo</th>
                <th className="px-3 py-2 text-right">Salário Máximo</th>
                {podeGerenciar && <th className="px-3 py-2 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={podeGerenciar ? 5 : 4} className="px-3 py-6 text-center text-gray-400">
                    Nenhuma faixa cadastrada com os filtros atuais.
                  </td>
                </tr>
              )}
              {registrosFiltrados.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    {r.cargoCodigo} — {r.cargoNome}
                  </td>
                  <td className="px-3 py-2">{r.senioridadeDescricao}</td>
                  {editandoId === r.id ? (
                    <>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={formEdicao.salarioMinimo}
                          onChange={(e) => setFormEdicao((f) => ({ ...f, salarioMinimo: e.target.value }))}
                          className="w-28 rounded border px-2 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={formEdicao.salarioMaximo}
                          onChange={(e) => setFormEdicao((f) => ({ ...f, salarioMaximo: e.target.value }))}
                          className="w-28 rounded border px-2 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={handleSalvarEdicao} className="mr-2 text-xs text-blue-700 hover:underline">
                          Salvar
                        </button>
                        <button type="button" onClick={() => setEditandoId(null)} className="text-xs text-gray-500 hover:underline">
                          Cancelar
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(r.salarioMinimo)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(r.salarioMaximo)}</td>
                      {podeGerenciar && (
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => iniciarEdicao(r)} className="mr-3 text-xs text-blue-700 hover:underline">
                            Editar
                          </button>
                          <button type="button" onClick={() => handleExcluirFaixa(r.id)} className="text-xs text-red-600 hover:underline">
                            Excluir
                          </button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
