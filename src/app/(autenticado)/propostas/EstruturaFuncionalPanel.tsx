'use client';

import { useState } from 'react';
import { OrganogramaPanel } from './OrganogramaPanel';
import { CargoPanel, type CargoComAlocacoes } from './CargoPanel';
import { TabelaSalarialListPanel } from '../tabela-salarial/TabelaSalarialListPanel';
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
  cargosIniciais: CargoComAlocacoes[];
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
  const [novoCargoAberto, setNovoCargoAberto] = useState(false);

  const unidadesAnaliticas = unidades.filter((u) => u.tipoNivel.startsWith('ANALITICO_'));
  const opcoesCargoDaProposta = cargos.map((c) => ({ id: c.id, label: `${c.codigoCargo} — ${c.nomeCargoMercado}` }));

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-1 border-b">
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
            <button
              type="button"
              onClick={() => setNovoCargoAberto(true)}
              className="self-start rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900"
            >
              + Novo Cargo
            </button>
          )}

          <TabelaSalarialListPanel
            registrosIniciais={tabelaSalarialIniciais}
            senioridadesIniciais={senioridadesIniciais}
            opcoesCargo={opcoesCargoDaProposta}
            podeGerenciar={podeGerenciarTabelaSalarial && !readOnly}
            restringirCargoIds={cargos.map((c) => c.id)}
          />

          {novoCargoAberto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-y-auto rounded-xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-5 py-3">
                  <h3 className="text-sm font-semibold text-slate-800">Novo Cargo</h3>
                  <button type="button" onClick={() => setNovoCargoAberto(false)} className="text-gray-400 hover:text-gray-600">
                    ✕
                  </button>
                </div>
                <div className="p-4">
                  <CargoPanel
                    propostaId={propostaId}
                    unidadesAnaliticas={unidadesAnaliticas}
                    contasAnaliticas={contasAnaliticas}
                    cargosIniciais={[]}
                    readOnly={false}
                    modoCriacaoApenas
                    onCargoCriado={(cargo) => {
                      setCargos((atual) => [...atual, cargo]);
                      setNovoCargoAberto(false);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
