'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import {
  criarUnidadeFuncional,
  importarEstruturaOrganizacional,
  inativarUnidadeFuncional,
  listarPropostasParaImportarEstrutura,
  type UnidadeFuncionalResultado,
} from './estrutura-actions';

type TipoNivel = UnidadeFuncionalResultado['tipoNivel'];

const TIPOS: { value: TipoNivel; label: string; sintetico: boolean }[] = [
  { value: 'SINTETICO_DIRETORIA', label: 'Diretoria (Sintético)', sintetico: true },
  { value: 'SINTETICO_GERENCIA', label: 'Gerência (Sintético)', sintetico: true },
  { value: 'ANALITICO_ASSESSOR', label: 'Assessoria (Analítico)', sintetico: false },
  { value: 'ANALITICO_COORDENADORIA', label: 'Coordenadoria (Analítico)', sintetico: false },
  { value: 'ANALITICO_SETOR', label: 'Setor (Analítico)', sintetico: false },
];

// US-106/US-116, RN_EST_02 — vínculo pai-filho rígido por tipo.
const PAI_VALIDO: Record<TipoNivel, TipoNivel[]> = {
  SINTETICO_DIRETORIA: [],
  SINTETICO_GERENCIA: [],
  ANALITICO_ASSESSOR: ['SINTETICO_DIRETORIA'],
  ANALITICO_COORDENADORIA: ['SINTETICO_GERENCIA'],
  ANALITICO_SETOR: ['SINTETICO_GERENCIA'],
};

/** US-116 (UC03.18) — Gerenciar Estrutura Funcional (Organograma) da Proposta. */
export function OrganogramaPanel({
  propostaId,
  unidadesIniciais,
  onUnidadesChange,
  readOnly,
}: {
  propostaId: string;
  unidadesIniciais: UnidadeFuncionalResultado[];
  onUnidadesChange: (unidades: UnidadeFuncionalResultado[]) => void;
  readOnly?: boolean;
}) {
  const [unidades, setUnidades] = useState(unidadesIniciais);
  const [nome, setNome] = useState('');
  const [tipoNivel, setTipoNivel] = useState<TipoNivel>('SINTETICO_DIRETORIA');
  const [idPai, setIdPai] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [importOpen, setImportOpen] = useState(false);
  const [propostasOrigem, setPropostasOrigem] = useState<{ id: string; codigo: string; nome: string }[] | null>(null);
  const [propostaOrigemId, setPropostaOrigemId] = useState('');
  const [importErro, setImportErro] = useState<string | null>(null);
  const [importPending, startImportTransition] = useTransition();

  useEffect(() => {
    if (!importOpen || propostasOrigem !== null) return;
    listarPropostasParaImportarEstrutura(propostaId).then((resposta) => {
      if (resposta.sucesso) {
        setPropostasOrigem(resposta.dados);
      } else {
        setImportErro(resposta.mensagem);
        setPropostasOrigem([]);
      }
    });
  }, [importOpen, propostasOrigem, propostaId]);

  function importar() {
    if (!propostaOrigemId) return;
    setImportErro(null);
    startImportTransition(async () => {
      const resposta = await importarEstruturaOrganizacional({ propostaOrigemId, propostaDestinoId: propostaId });
      if (!resposta.sucesso) {
        setImportErro(resposta.mensagem);
        return;
      }
      // Substituição total — a lista local não reflete o resultado item a item,
      // então recarrega a página para trazer a árvore importada já persistida.
      window.location.reload();
    });
  }

  function atualizar(novas: UnidadeFuncionalResultado[]) {
    setUnidades(novas);
    onUnidadesChange(novas);
  }

  const paisValidos = PAI_VALIDO[tipoNivel];
  const opcoesPai = unidades.filter((u) => paisValidos.includes(u.tipoNivel));
  const ehRaiz = paisValidos.length === 0;

  function criar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await criarUnidadeFuncional({
        propostaId,
        nome,
        tipoNivel,
        idPai: ehRaiz ? undefined : idPai || undefined,
      });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      atualizar([...unidades, resposta.dados]);
      setNome('');
      setIdPai('');
    });
  }

  function inativar(unidadeId: string) {
    setErro(null);
    startTransition(async () => {
      const resposta = await inativarUnidadeFuncional(propostaId, unidadeId);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      atualizar(unidades.filter((u) => u.id !== unidadeId));
    });
  }

  const nomePai = (id: string | null) => unidades.find((u) => u.id === id)?.nome ?? '—';

  return (
    <div className="flex flex-col gap-4 rounded border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-medium">Estrutura Funcional (Organograma)</h3>
          <Link
            href={`/propostas/${propostaId}/empregados`}
            className="text-xs text-blue-700 underline hover:text-blue-900"
          >
            Empregados
          </Link>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded border border-blue-600 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50"
          >
            Importar de outra Proposta
          </button>
        )}
      </div>

      {importOpen && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3">
          <p className="mb-2 text-xs text-gray-700">
            A importação <strong>substitui</strong> toda a Estrutura Organizacional já cadastrada nesta Proposta pela
            estrutura da Proposta selecionada. É uma cópia independente — alterações futuras na origem não afetam esta
            Proposta.
          </p>
          {propostasOrigem === null && <p className="text-xs text-gray-500">Carregando Propostas disponíveis...</p>}
          {propostasOrigem !== null && propostasOrigem.length === 0 && (
            <p className="text-xs text-gray-500">Nenhuma outra Proposta com Estrutura Organizacional cadastrada.</p>
          )}
          {propostasOrigem !== null && propostasOrigem.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={propostaOrigemId}
                onChange={(e) => setPropostaOrigemId(e.target.value)}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="">Selecione a Proposta de origem...</option>
                {propostasOrigem.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} — {p.nome}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={importar}
                disabled={importPending || !propostaOrigemId}
                className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                {importPending ? 'Importando...' : 'Confirmar Importação'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportOpen(false);
                  setImportErro(null);
                  setPropostaOrigemId('');
                }}
                disabled={importPending}
                className="text-xs text-gray-500 hover:underline disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          )}
          {importErro && <p className="mt-2 text-xs text-red-600">{importErro}</p>}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-gray-500">
            <th className="py-1">Nome</th>
            <th className="py-1">Tipo</th>
            <th className="py-1">Unidade Superior</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {unidades.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-center text-gray-400">
                Nenhuma unidade funcional cadastrada.
              </td>
            </tr>
          )}
          {unidades.map((u) => (
            <tr key={u.id} className="border-b last:border-0">
              <td className="py-1.5">{u.nome}</td>
              <td className="py-1.5">{TIPOS.find((t) => t.value === u.tipoNivel)?.label ?? u.tipoNivel}</td>
              <td className="py-1.5">{nomePai(u.idPai)}</td>
              <td className="py-1.5 text-right">
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => inativar(u.id)}
                    disabled={pending}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    Inativar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {!readOnly && (
        <div className="grid grid-cols-1 gap-3 border-t pt-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
            <select
              value={tipoNivel}
              onChange={(e) => {
                setTipoNivel(e.target.value as TipoNivel);
                setIdPai('');
              }}
              className="w-full rounded border px-2 py-1 text-sm"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Unidade Superior</label>
            <select
              value={idPai}
              onChange={(e) => setIdPai(e.target.value)}
              disabled={ehRaiz}
              className="w-full rounded border px-2 py-1 text-sm disabled:opacity-50"
            >
              <option value="">{ehRaiz ? 'N/A (sempre raiz)' : 'Selecione...'}</option>
              {opcoesPai.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={criar}
              disabled={pending || nome.trim().length === 0 || (!ehRaiz && !idPai)}
              className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {pending ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
