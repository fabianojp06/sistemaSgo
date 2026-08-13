'use client';

import { useState } from 'react';
import { OrganogramaPanel } from './OrganogramaPanel';
import { CargoPanel } from './CargoPanel';
import { TabelaSalarialListPanel } from '../tabela-salarial/TabelaSalarialListPanel';
import type { UnidadeFuncionalResultado, CargoResultado, TabelaSalarialResultado, SenioridadeResultado } from './estrutura-actions';

type CargoComAlocacoes = CargoResultado & { alocacoes: { unidadeFuncionalId: string; percentual: string }[] };

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

  const unidadesAnaliticas = unidades.filter((u) => u.tipoNivel.startsWith('ANALITICO_'));
  const opcoesCargoDaProposta = cargosIniciais.map((c) => ({ id: c.id, label: `${c.codigoCargo} — ${c.nomeCargoMercado}` }));

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
          cargosIniciais={cargosIniciais}
          readOnly={readOnly}
        />
      )}

      {subAba === 'tabela-salarial' && (
        <TabelaSalarialListPanel
          registrosIniciais={tabelaSalarialIniciais}
          senioridadesIniciais={senioridadesIniciais}
          opcoesCargo={opcoesCargoDaProposta}
          podeGerenciar={podeGerenciarTabelaSalarial && !readOnly}
          restringirCargoIds={cargosIniciais.map((c) => c.id)}
        />
      )}
    </div>
  );
}
