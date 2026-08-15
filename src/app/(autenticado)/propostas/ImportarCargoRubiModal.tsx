'use client';

import { useState, useTransition } from 'react';
import { buscarCargosRubi, importarCargoRubi, type CandidatoCargoRubiResultado, type CargoResultado } from './estrutura-actions';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: string): string {
  return formatadorMoeda.format(Number(valor));
}

const FAIXAS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'];
const NIVEIS = Array.from({ length: 20 }, (_, i) => `N${i + 1}`);

type Props = {
  cargoId: string;
  onFechar: () => void;
  /** Recebe o Cargo já atualizado (5 campos importados) para refletir na tela sem reload. */
  onImportado: (cargo: CargoResultado) => void;
};

/**
 * ADR-045 (US-132) — modal "Importar do Rubi": busca por termo livre → lista de
 * candidatos (Nome, Tabela Salarial, Faixa, Nível, Salário Real) → seleção → import
 * em bloco via importarCargoRubi. Nada é gravado enquanto o usuário só busca.
 */
export function ImportarCargoRubiModal({ cargoId, onFechar, onImportado }: Props) {
  const [faixa, setFaixa] = useState('');
  const [nivel, setNivel] = useState('');
  const [termo, setTermo] = useState('');
  const [candidatos, setCandidatos] = useState<CandidatoCargoRubiResultado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, startBuscando] = useTransition();
  const [importando, startImportando] = useTransition();
  const [importandoIndice, setImportandoIndice] = useState<number | null>(null);

  function buscar() {
    if (!faixa && !nivel && !termo.trim()) {
      setErro('Selecione Faixa e/ou Nível, ou digite um termo de busca (nome do cargo ou código do Rubi).');
      return;
    }
    setErro(null);
    setCandidatos(null);
    startBuscando(async () => {
      const resposta = await buscarCargosRubi({
        faixa: faixa || undefined,
        nivel: nivel || undefined,
        termo: termo.trim() || undefined,
      });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setCandidatos(resposta.dados);
    });
  }

  function selecionar(candidato: CandidatoCargoRubiResultado, indice: number) {
    setErro(null);
    setImportandoIndice(indice);
    startImportando(async () => {
      const resposta = await importarCargoRubi({ cargoId, candidato });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        setImportandoIndice(null);
        return;
      }
      onImportado(resposta.dados);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Importar do Rubi</h3>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-3 rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
            O nome importado é gravado em &quot;Nome Cargo CTCEA&quot; — o campo &quot;Nome do Cargo (Mercado)&quot; não é alterado por esta importação.
          </p>
          {erro && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}

          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-500">Faixa</label>
              <select
                value={faixa}
                onChange={(e) => setFaixa(e.target.value)}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="">Todas</option>
                {FAIXAS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-500">Nível</label>
              <select
                value={nivel}
                onChange={(e) => setNivel(e.target.value)}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="">Todos</option>
                {NIVEIS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={buscando}
              onClick={buscar}
              className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {buscando ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          <div className="mb-4">
            <label className="text-[11px] font-medium text-gray-500">Termo (busca complementar por nome do cargo)</label>
            <input
              type="text"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              placeholder="Nome do cargo ou código do Rubi — só encontra resultado se já cadastrado (ex: Analista de Sistemas)"
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
            />
          </div>

          {candidatos !== null && candidatos.length === 0 && (
            <p className="text-xs text-gray-400">Nenhum cargo encontrado no Rubi para esse termo.</p>
          )}

          {candidatos !== null && candidatos.length > 0 && (
            <div className="flex flex-col gap-2">
              {candidatos.map((c, indice) => (
                <div key={`${c.tabSalCodigo}-${c.faixaCodigo}-${c.nivelCodigo}-${indice}`} className="rounded-lg border border-gray-100 bg-slate-50 p-3">
                  <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-700 md:grid-cols-2">
                    <p><span className="font-medium text-gray-500">Nome do Cargo (CTCEA):</span> {c.nomeCargoMercado}</p>
                    <p><span className="font-medium text-gray-500">Salário Real:</span> {formatarMoeda(c.salarioReal)}</p>
                    <p><span className="font-medium text-gray-500">Tabela Salarial:</span> {c.tabSalDescricao}</p>
                    <p><span className="font-medium text-gray-500">Faixa:</span> {c.faixaDescricao}</p>
                    <p><span className="font-medium text-gray-500">Nível:</span> {c.nivelDescricao}</p>
                  </div>
                  <button
                    type="button"
                    disabled={importando}
                    onClick={() => selecionar(c, indice)}
                    className="mt-2 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {importando && importandoIndice === indice ? 'Importando...' : 'Selecionar este candidato'}
                  </button>
                </div>
              ))}
            </div>
          )}
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
