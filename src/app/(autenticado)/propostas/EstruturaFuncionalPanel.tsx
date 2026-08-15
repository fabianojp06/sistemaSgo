'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { OrganogramaPanel } from './OrganogramaPanel';
import { CargoPanel, type CargoComVinculo } from './CargoPanel';
import { TabelaSalarialListPanel } from '../tabela-salarial/TabelaSalarialListPanel';
import { cadastrarCargoRascunho } from './estrutura-actions';
import type { UnidadeFuncionalResultado, TabelaSalarialResultado, SenioridadeResultado } from './estrutura-actions';

/** US-116/US-117/US-131 — mesma tela, três sub-seções: Organograma, Cargos e Tabela Salarial. */
export function EstruturaFuncionalPanel({
  propostaId,
  unidadesIniciais,
  cargosIniciais,
  contasAnaliticas,
  tabelaSalarialIniciais,
  senioridadesIniciais,
  podeGerenciarTabelaSalarial,
  readOnly,
}: {
  propostaId: string;
  unidadesIniciais: UnidadeFuncionalResultado[];
  cargosIniciais: CargoComVinculo[];
  contasAnaliticas: { id: string; label: string }[];
  tabelaSalarialIniciais: TabelaSalarialResultado[];
  senioridadesIniciais: SenioridadeResultado[];
  podeGerenciarTabelaSalarial: boolean;
  readOnly: boolean;
}) {
  const [subAba, setSubAba] = useState<'organograma' | 'cargos' | 'tabela-salarial'>('organograma');
  const [unidades, setUnidades] = useState(unidadesIniciais);
  // Elevado do Cargos tab para cá — pedido do usuário (2026-08-13) de cadastrar Cargo direto
  // da aba Tabela Salarial exige que o seletor de Cargo dessa aba veja o Cargo recém-criado
  // sem esperar reload da página.
  const [cargos, setCargos] = useState(cargosIniciais);
  const [novoCargoNome, setNovoCargoNome] = useState('');
  const [erroNovoCargo, setErroNovoCargo] = useState<string | null>(null);
  const [salvandoNovoCargo, startSalvandoNovoCargo] = useTransition();

  const unidadesAnaliticas = unidades.filter((u) => u.tipoNivel.startsWith('ANALITICO_'));
  const opcoesCargoDaProposta = cargos.map((c) => ({ id: c.id, label: `${c.codigoCargo} — ${c.nomeCargoMercado}` }));

  function handleCadastrarCargoRascunho() {
    if (!novoCargoNome.trim()) {
      setErroNovoCargo('Informe o nome do Cargo.');
      return;
    }
    setErroNovoCargo(null);
    startSalvandoNovoCargo(async () => {
      const resposta = await cadastrarCargoRascunho({ propostaId, nomeCargoMercado: novoCargoNome.trim() });
      if (!resposta.sucesso) {
        setErroNovoCargo(resposta.mensagem);
        return;
      }
      setCargos((atual) => [...atual, resposta.dados]);
      setNovoCargoNome('');
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center justify-between border-b">
        <div className="flex gap-1">
          {(
            [
              { slug: 'organograma', label: 'Estrutura Funcional (Organograma)' },
              { slug: 'cargos', label: 'Cargos' },
              { slug: 'tabela-salarial', label: 'Tabela Salarial' },
            ] as const
          ).map((sub) => (
            <button
              key={sub.slug}
              type="button"
              onClick={() => setSubAba(sub.slug)}
              className={`rounded-t px-3 py-1.5 text-sm ${
                subAba === sub.slug ? 'border-b-2 border-blue-600 font-medium text-blue-700' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>
        <Link href={`/propostas/${propostaId}/empregados`} className="px-3 py-1.5 text-sm text-blue-700 underline hover:text-blue-900">
          Empregados
        </Link>
      </nav>

      {subAba === 'organograma' && (
        <OrganogramaPanel propostaId={propostaId} unidadesIniciais={unidades} onUnidadesChange={setUnidades} readOnly={readOnly} />
      )}

      {subAba === 'cargos' && (
        <CargoPanel
          propostaId={propostaId}
          unidadesAnaliticas={unidadesAnaliticas}
          contasAnaliticas={contasAnaliticas}
          cargosIniciais={cargos}
          readOnly={readOnly}
        />
      )}

      {subAba === 'tabela-salarial' && (
        <div className="flex flex-col gap-3">
          {!readOnly && podeGerenciarTabelaSalarial && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-600">Novo Cargo (cadastro rápido)</label>
                <input
                  type="text"
                  value={novoCargoNome}
                  onChange={(e) => setNovoCargoNome(e.target.value)}
                  placeholder="Nome do Cargo (ex: Analista de Requisitos)"
                  className="w-full min-w-[240px] rounded border px-2 py-1.5 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={salvandoNovoCargo}
                onClick={handleCadastrarCargoRascunho}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {salvandoNovoCargo ? 'Salvando...' : '+ Cadastrar Cargo'}
              </button>
              <p className="w-full text-[11px] text-gray-400">
                Cria o Cargo só com o nome (código gerado automaticamente, ex: CARGO-2026-0001) — fica disponível para seleção aqui.
                Vínculo Funcional, Conta e Salário são completados depois na aba Cargos.
              </p>
              {erroNovoCargo && <p className="w-full text-xs text-red-600">{erroNovoCargo}</p>}
            </div>
          )}

          <TabelaSalarialListPanel
            registrosIniciais={tabelaSalarialIniciais}
            senioridadesIniciais={senioridadesIniciais}
            opcoesCargo={opcoesCargoDaProposta}
            podeGerenciar={podeGerenciarTabelaSalarial && !readOnly}
            restringirCargoIds={cargos.map((c) => c.id)}
          />
        </div>
      )}
    </div>
  );
}
