'use client';

import { useRef, useState, useTransition } from 'react';
import { cadastrarViagem, excluirViagem, type ViagemResultado } from '@/app/plano-contas/actions';
import { SeletorContaAnalitica } from './SeletorContaAnalitica';

type ContaOpcao = { id: string; label: string };

type ValoresFormulario = {
  descricao: string;
  quantidadePessoas: number;
  mediaDias: number;
  custoUnitarioPassagem: number;
  contaPassagemId: string;
  custoUnitarioDiaria: number;
  contaDiariaId: string;
  custoUnitarioTransporte: number;
  contaTransporteId: string;
};

function NovaViagemForm({
  versaoId,
  contasAnaliticas,
  readOnly,
  valoresIniciais,
  onCriada,
}: {
  versaoId: string;
  contasAnaliticas: ContaOpcao[];
  readOnly?: boolean;
  valoresIniciais: ValoresFormulario;
  onCriada: (resultado: ViagemResultado) => void;
}) {
  const [descricao, setDescricao] = useState(valoresIniciais.descricao);
  const [quantidadePessoas, setQuantidadePessoas] = useState(valoresIniciais.quantidadePessoas);
  const [mediaDias, setMediaDias] = useState(valoresIniciais.mediaDias);
  const [custoUnitarioPassagem, setCustoUnitarioPassagem] = useState(valoresIniciais.custoUnitarioPassagem);
  const [contaPassagemId, setContaPassagemId] = useState(valoresIniciais.contaPassagemId || contasAnaliticas[0]?.id || '');
  const [custoUnitarioDiaria, setCustoUnitarioDiaria] = useState(valoresIniciais.custoUnitarioDiaria);
  const [contaDiariaId, setContaDiariaId] = useState(valoresIniciais.contaDiariaId || contasAnaliticas[0]?.id || '');
  const [custoUnitarioTransporte, setCustoUnitarioTransporte] = useState(valoresIniciais.custoUnitarioTransporte);
  const [contaTransporteId, setContaTransporteId] = useState(valoresIniciais.contaTransporteId || contasAnaliticas[0]?.id || '');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (readOnly) return null;
  if (contasAnaliticas.length === 0) return <p className="text-sm text-slate-500">Nenhuma conta analítica disponível.</p>;

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await cadastrarViagem({
        versaoId,
        descricao,
        quantidadePessoas,
        mediaDias,
        custoUnitarioPassagem,
        contaPassagemId,
        custoUnitarioDiaria,
        contaDiariaId,
        custoUnitarioTransporte,
        contaTransporteId,
      });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setDescricao('');
      onCriada(resposta.dados);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm md:p-5">
      <h4 className="text-sm font-semibold text-slate-800">Nova Viagem</h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">Descrição</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={100}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Quantidade de Pessoas</label>
          <input
            type="number"
            min={1}
            value={quantidadePessoas}
            onChange={(e) => setQuantidadePessoas(Number(e.target.value))}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Média de Dias</label>
          <input
            type="number"
            min={1}
            value={mediaDias}
            onChange={(e) => setMediaDias(Number(e.target.value))}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Custo Unit. Passagem</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={custoUnitarioPassagem}
            onChange={(e) => setCustoUnitarioPassagem(Number(e.target.value))}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Conta — Passagem</label>
          <SeletorContaAnalitica contas={contasAnaliticas} value={contaPassagemId} onChange={setContaPassagemId} />
        </div>
        <div />

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Custo Unit. Diária</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={custoUnitarioDiaria}
            onChange={(e) => setCustoUnitarioDiaria(Number(e.target.value))}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Conta — Diária</label>
          <SeletorContaAnalitica contas={contasAnaliticas} value={contaDiariaId} onChange={setContaDiariaId} />
        </div>
        <div />

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Custo Unit. Transporte</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={custoUnitarioTransporte}
            onChange={(e) => setCustoUnitarioTransporte(Number(e.target.value))}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Conta — Transporte</label>
          <SeletorContaAnalitica contas={contasAnaliticas} value={contaTransporteId} onChange={setContaTransporteId} />
        </div>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div>
        <button
          type="button"
          onClick={salvar}
          disabled={pending || descricao.trim().length === 0}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Cadastrar'}
        </button>
      </div>
    </div>
  );
}

const VALORES_VAZIOS: ValoresFormulario = {
  descricao: '',
  quantidadePessoas: 1,
  mediaDias: 1,
  custoUnitarioPassagem: 0,
  contaPassagemId: '',
  custoUnitarioDiaria: 0,
  contaDiariaId: '',
  custoUnitarioTransporte: 0,
  contaTransporteId: '',
};

/** US-109/US-115 — Viagens (POR_META ou CONSOLIDADA; Meta só é exigida pelo use case quando POR_META).
 * Redesign visual desta sessão: mesma linguagem de EmpregadoPanel.tsx (cards com sombra leve,
 * bordas suaves, slate-* para hierarquia neutra). Botão "Copiar" pré-preenche o formulário
 * (`chaveFormulario` força o React a remontar o form com os novos valores iniciais) com os
 * dados da Viagem clicada, sem nova Server Action — reaproveita `cadastrarViagem` já existente,
 * é só um atalho de preenchimento para agilizar cadastro repetitivo. */
export function ViagemPanel({
  versaoId,
  contasAnaliticas,
  viagensIniciais = [],
  readOnly,
}: {
  versaoId: string;
  contasAnaliticas: ContaOpcao[];
  viagensIniciais?: ViagemResultado[];
  readOnly?: boolean;
}) {
  const [viagens, setViagens] = useState(viagensIniciais);
  const [pending, startTransition] = useTransition();
  const [valoresFormulario, setValoresFormulario] = useState<ValoresFormulario>(VALORES_VAZIOS);
  const [chaveFormulario, setChaveFormulario] = useState(0);
  const formularioRef = useRef<HTMLDivElement>(null);

  function excluir(viagemId: string) {
    startTransition(async () => {
      const resposta = await excluirViagem(viagemId);
      if (resposta.sucesso) setViagens((atual) => atual.filter((v) => v.id !== viagemId));
    });
  }

  function copiar(viagem: ViagemResultado) {
    setValoresFormulario({
      descricao: `${viagem.descricao} (cópia)`,
      quantidadePessoas: viagem.quantidadePessoas,
      mediaDias: viagem.mediaDias,
      custoUnitarioPassagem: Number(viagem.custoUnitarioPassagem),
      contaPassagemId: viagem.contaPassagemId,
      custoUnitarioDiaria: Number(viagem.custoUnitarioDiaria),
      contaDiariaId: viagem.contaDiariaId,
      custoUnitarioTransporte: Number(viagem.custoUnitarioTransporte),
      contaTransporteId: viagem.contaTransporteId,
    });
    setChaveFormulario((k) => k + 1);
    formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4 md:p-6">
      <h3 className="font-semibold text-slate-800">Viagens</h3>
      <div ref={formularioRef}>
        <NovaViagemForm
          key={chaveFormulario}
          versaoId={versaoId}
          contasAnaliticas={contasAnaliticas}
          readOnly={readOnly}
          valoresIniciais={valoresFormulario}
          onCriada={(v) => {
            setViagens((atual) => [...atual, v]);
            setValoresFormulario(VALORES_VAZIOS);
            setChaveFormulario((k) => k + 1);
          }}
        />
      </div>
      {viagens.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma Viagem cadastrada.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {viagens.map((viagem) => (
            <li
              key={viagem.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-sm shadow-sm"
            >
              <span>
                {viagem.descricao} — <span className="text-xs text-slate-500">custo estimado R$ {viagem.custoEstimado}</span>
              </span>
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copiar(viagem)}
                    disabled={pending}
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={() => excluir(viagem.id)}
                    disabled={pending}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
