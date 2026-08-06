'use client';

import { useState, useTransition } from 'react';
import {
  cadastrarCargo,
  editarCargo,
  configurarBeneficiosCargo,
  type CargoResultado,
  type UnidadeFuncionalResultado,
} from './estrutura-actions';

type Alocacao = { unidadeFuncionalId: string; percentual: string };
type CargoComAlocacoes = CargoResultado & { alocacoes: Alocacao[] };

const FONTES = [
  { value: 'MERCADO_MINIMO', label: 'Mercado Mínimo' },
  { value: 'MERCADO_MAXIMO', label: 'Mercado Máximo' },
  { value: 'RUBI', label: 'Rubi (Salário Real)' },
] as const;

function dadosVazios() {
  return {
    nomeCargoMercado: '',
    contaId: '',
    fonteAtiva: 'MERCADO_MINIMO' as (typeof FONTES)[number]['value'],
    salarioMercadoMinimo: '',
    salarioMercadoMaximo: '',
    funcaoGratificada: '',
    periodoInicio: '',
  };
}

/** US-117 (UC03.19, blocos A/B) — Gerenciar Cargos (dados de mercado, conta, rateio funcional). */
export function CargoPanel({
  propostaId,
  unidadesAnaliticas,
  contasAnaliticas,
  cargosIniciais,
  readOnly,
}: {
  propostaId: string;
  unidadesAnaliticas: UnidadeFuncionalResultado[];
  contasAnaliticas: { id: string; label: string }[];
  cargosIniciais: CargoComAlocacoes[];
  readOnly?: boolean;
}) {
  const [cargos, setCargos] = useState(cargosIniciais);
  const [cargoEmEdicaoId, setCargoEmEdicaoId] = useState<string | null>(null);
  const [dados, setDados] = useState(dadosVazios());
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const somaPercentual = alocacoes.reduce((soma, a) => soma + (Number(a.percentual) || 0), 0);

  function iniciarEdicao(cargo: CargoComAlocacoes | null) {
    setErro(null);
    if (!cargo) {
      setCargoEmEdicaoId(null);
      setDados(dadosVazios());
      setAlocacoes([]);
      return;
    }
    setCargoEmEdicaoId(cargo.id);
    setDados({
      nomeCargoMercado: cargo.nomeCargoMercado,
      contaId: cargo.contaId,
      fonteAtiva: cargo.fonteAtiva,
      salarioMercadoMinimo: cargo.salarioMercadoMinimo,
      salarioMercadoMaximo: cargo.salarioMercadoMaximo,
      funcaoGratificada: cargo.funcaoGratificada ?? '',
      periodoInicio: cargo.periodoInicio.slice(0, 10),
    });
    setAlocacoes(cargo.alocacoes);
  }

  function adicionarAlocacao() {
    if (unidadesAnaliticas.length === 0) return;
    setAlocacoes((atual) => [...atual, { unidadeFuncionalId: unidadesAnaliticas[0].id, percentual: '' }]);
  }

  function atualizarAlocacao(index: number, campo: keyof Alocacao, valor: string) {
    setAlocacoes((atual) => atual.map((a, i) => (i === index ? { ...a, [campo]: valor } : a)));
  }

  function removerAlocacao(index: number) {
    setAlocacoes((atual) => atual.filter((_, i) => i !== index));
  }

  function salvar() {
    setErro(null);
    const payload = {
      propostaId,
      alocacoes: alocacoes.map((a) => ({ unidadeFuncionalId: a.unidadeFuncionalId, percentual: Number(a.percentual) })),
      contaId: dados.contaId,
      nomeCargoMercado: dados.nomeCargoMercado,
      funcaoGratificada: dados.funcaoGratificada === '' ? null : Number(dados.funcaoGratificada),
      periodoInicio: new Date(dados.periodoInicio),
      salarioMercadoMinimo: Number(dados.salarioMercadoMinimo),
      salarioMercadoMaximo: Number(dados.salarioMercadoMaximo),
      fonteAtiva: dados.fonteAtiva,
    };

    startTransition(async () => {
      const resposta = cargoEmEdicaoId
        ? await editarCargo({ ...payload, cargoId: cargoEmEdicaoId })
        : await cadastrarCargo(payload);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      const cargoSalvo: CargoComAlocacoes = { ...resposta.dados, alocacoes };
      setCargos((atual) => {
        const existe = atual.some((c) => c.id === cargoSalvo.id);
        return existe ? atual.map((c) => (c.id === cargoSalvo.id ? cargoSalvo : c)) : [...atual, cargoSalvo];
      });
      iniciarEdicao(null);
    });
  }

  const podeSalvar =
    dados.nomeCargoMercado.trim().length > 0 &&
    dados.contaId !== '' &&
    dados.periodoInicio !== '' &&
    dados.salarioMercadoMinimo !== '' &&
    dados.salarioMercadoMaximo !== '' &&
    alocacoes.length > 0 &&
    Math.abs(somaPercentual - 100) < 0.01;

  return (
    <div className="flex flex-col gap-4 rounded border p-4">
      <h3 className="font-medium">Cargos</h3>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-gray-500">
            <th className="py-1">Código</th>
            <th className="py-1">Cargo (Mercado)</th>
            <th className="py-1">Salário Total</th>
            <th className="py-1">Custo Total</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {cargos.length === 0 && (
            <tr>
              <td colSpan={5} className="py-3 text-center text-gray-400">
                Nenhum cargo cadastrado.
              </td>
            </tr>
          )}
          {cargos.map((c) => (
            <tr key={c.id} className="border-b last:border-0">
              <td className="py-1.5">{c.codigoCargo}</td>
              <td className="py-1.5">{c.nomeCargoMercado}</td>
              <td className="py-1.5">R$ {c.salarioTotal}</td>
              <td className="py-1.5">R$ {c.custoTotalCargo}</td>
              <td className="py-1.5 text-right">
                {!readOnly && (
                  <button type="button" onClick={() => iniciarEdicao(c)} className="text-xs text-blue-700 hover:underline">
                    Editar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {!readOnly && (
        <div className="flex flex-col gap-3 border-t pt-3">
          <p className="text-xs font-medium text-gray-600">{cargoEmEdicaoId ? 'Editar Cargo' : 'Novo Cargo'}</p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nome do Cargo (Mercado)</label>
              <input
                type="text"
                value={dados.nomeCargoMercado}
                onChange={(e) => setDados((d) => ({ ...d, nomeCargoMercado: e.target.value }))}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Conta Contábil (natureza da despesa)</label>
              <select
                value={dados.contaId}
                onChange={(e) => setDados((d) => ({ ...d, contaId: e.target.value }))}
                className="w-full rounded border px-2 py-1 text-sm"
              >
                <option value="">Selecione...</option>
                {contasAnaliticas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Período Início</label>
              <input
                type="date"
                value={dados.periodoInicio}
                onChange={(e) => setDados((d) => ({ ...d, periodoInicio: e.target.value }))}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Salário Mercado Mínimo</label>
              <input
                type="number"
                value={dados.salarioMercadoMinimo}
                onChange={(e) => setDados((d) => ({ ...d, salarioMercadoMinimo: e.target.value }))}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Salário Mercado Máximo</label>
              <input
                type="number"
                value={dados.salarioMercadoMaximo}
                onChange={(e) => setDados((d) => ({ ...d, salarioMercadoMaximo: e.target.value }))}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Função Gratificada (opcional)</label>
              <input
                type="number"
                value={dados.funcaoGratificada}
                onChange={(e) => setDados((d) => ({ ...d, funcaoGratificada: e.target.value }))}
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Fonte Ativa</label>
              <select
                value={dados.fonteAtiva}
                onChange={(e) => setDados((d) => ({ ...d, fonteAtiva: e.target.value as (typeof FONTES)[number]['value'] }))}
                className="w-full rounded border px-2 py-1 text-sm"
              >
                {FONTES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">
                Rateio Funcional (soma deve ser 100% — atual: {somaPercentual.toFixed(2)}%)
              </p>
              <button type="button" onClick={adicionarAlocacao} className="text-xs text-blue-700 hover:underline">
                + Adicionar unidade
              </button>
            </div>
            {alocacoes.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={a.unidadeFuncionalId}
                  onChange={(e) => atualizarAlocacao(i, 'unidadeFuncionalId', e.target.value)}
                  className="flex-1 rounded border px-2 py-1 text-sm"
                >
                  {unidadesAnaliticas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={a.percentual}
                  onChange={(e) => atualizarAlocacao(i, 'percentual', e.target.value)}
                  placeholder="%"
                  className="w-24 rounded border px-2 py-1 text-sm"
                />
                <button type="button" onClick={() => removerAlocacao(i)} className="text-xs text-red-600 hover:underline">
                  Remover
                </button>
              </div>
            ))}
            {unidadesAnaliticas.length === 0 && (
              <p className="text-xs text-gray-400">Cadastre ao menos uma unidade funcional Analítica no Organograma antes de vincular um Cargo.</p>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={salvar}
              disabled={pending || !podeSalvar}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {pending ? 'Salvando...' : cargoEmEdicaoId ? 'Salvar Cargo' : 'Cadastrar Cargo'}
            </button>
            {cargoEmEdicaoId && (
              <button type="button" onClick={() => iniciarEdicao(null)} className="ml-2 text-sm text-gray-500 hover:underline">
                Cancelar
              </button>
            )}
          </div>

          {cargoEmEdicaoId && (
            <BeneficiosForm
              propostaId={propostaId}
              cargo={cargos.find((c) => c.id === cargoEmEdicaoId) ?? null}
              onSalvo={(atualizado) =>
                setCargos((atual) => atual.map((c) => (c.id === atualizado.id ? { ...atualizado, alocacoes: c.alocacoes } : c)))
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

function BeneficiosForm({
  propostaId,
  cargo,
  onSalvo,
}: {
  propostaId: string;
  cargo: CargoComAlocacoes | null;
  onSalvo: (cargo: CargoResultado) => void;
}) {
  const [dados, setDados] = useState(() => ({
    encargosSociaisPct: cargo?.encargosSociaisPct ?? '0',
    vaAtivo: cargo?.vaAtivo ?? false,
    vaValorUnitario: cargo?.vaValorUnitario ?? '0',
    vrAtivo: cargo?.vrAtivo ?? false,
    vrValorUnitario: cargo?.vrValorUnitario ?? '0',
    planoSaudeAtivo: cargo?.planoSaudeAtivo ?? false,
    planoSaudeFaixa: cargo?.planoSaudeFaixa ?? null,
    planoSaudeValor: cargo?.planoSaudeValor ?? '0',
    planoOdontoAtivo: cargo?.planoOdontoAtivo ?? false,
    planoOdontoValor: cargo?.planoOdontoValor ?? '0',
    seguroVidaAtivo: cargo?.seguroVidaAtivo ?? false,
    seguroVidaValor: cargo?.seguroVidaValor ?? '0',
    auxilioCrecheAtivo: cargo?.auxilioCrecheAtivo ?? false,
    auxilioCrecheValor: cargo?.auxilioCrecheValor ?? '0',
    transporteAtivo: cargo?.transporteAtivo ?? false,
    transporteValorUnitario: cargo?.transporteValorUnitario ?? '0',
  }));
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!cargo) return null;

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await configurarBeneficiosCargo({
        propostaId,
        cargoId: cargo!.id,
        encargosSociaisPct: Number(dados.encargosSociaisPct),
        vaAtivo: dados.vaAtivo,
        vaValorUnitario: Number(dados.vaValorUnitario),
        vrAtivo: dados.vrAtivo,
        vrValorUnitario: Number(dados.vrValorUnitario),
        planoSaudeAtivo: dados.planoSaudeAtivo,
        planoSaudeFaixa: dados.planoSaudeFaixa,
        planoSaudeValor: Number(dados.planoSaudeValor),
        planoOdontoAtivo: dados.planoOdontoAtivo,
        planoOdontoValor: Number(dados.planoOdontoValor),
        seguroVidaAtivo: dados.seguroVidaAtivo,
        seguroVidaValor: Number(dados.seguroVidaValor),
        auxilioCrecheAtivo: dados.auxilioCrecheAtivo,
        auxilioCrecheValor: Number(dados.auxilioCrecheValor),
        transporteAtivo: dados.transporteAtivo,
        transporteValorUnitario: Number(dados.transporteValorUnitario),
      });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      onSalvo(resposta.dados);
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <p className="text-xs font-medium text-gray-600">Benefícios e Encargos — {cargo.codigoCargo}</p>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Encargos Sociais (%)</label>
        <input
          type="number"
          value={dados.encargosSociaisPct}
          onChange={(e) => setDados((d) => ({ ...d, encargosSociaisPct: e.target.value }))}
          className="w-32 rounded border px-2 py-1 text-sm"
        />
      </div>

      {(
        [
          { ativo: 'vaAtivo', valor: 'vaValorUnitario', label: 'Vale Alimentação' },
          { ativo: 'vrAtivo', valor: 'vrValorUnitario', label: 'Vale Refeição' },
          { ativo: 'planoOdontoAtivo', valor: 'planoOdontoValor', label: 'Plano Odontológico' },
          { ativo: 'seguroVidaAtivo', valor: 'seguroVidaValor', label: 'Seguro de Vida' },
          { ativo: 'auxilioCrecheAtivo', valor: 'auxilioCrecheValor', label: 'Auxílio Creche' },
          { ativo: 'transporteAtivo', valor: 'transporteValorUnitario', label: 'Vale Transporte' },
        ] as const
      ).map((b) => (
        <div key={b.ativo} className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={dados[b.ativo]}
              onChange={(e) => setDados((d) => ({ ...d, [b.ativo]: e.target.checked }))}
            />
            {b.label}
          </label>
          <input
            type="number"
            value={dados[b.valor]}
            onChange={(e) => setDados((d) => ({ ...d, [b.valor]: e.target.value }))}
            disabled={!dados[b.ativo]}
            className="w-32 rounded border px-2 py-1 text-sm disabled:opacity-50"
          />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={dados.planoSaudeAtivo}
            onChange={(e) => setDados((d) => ({ ...d, planoSaudeAtivo: e.target.checked }))}
          />
          Plano de Saúde
        </label>
        <select
          value={dados.planoSaudeFaixa ?? ''}
          onChange={(e) => setDados((d) => ({ ...d, planoSaudeFaixa: (e.target.value || null) as typeof d.planoSaudeFaixa }))}
          disabled={!dados.planoSaudeAtivo}
          className="rounded border px-2 py-1 text-sm disabled:opacity-50"
        >
          <option value="">Faixa...</option>
          <option value="BASICO">Básico</option>
          <option value="INTERMEDIARIO">Intermediário</option>
          <option value="EXECUTIVO">Executivo</option>
        </select>
        <input
          type="number"
          value={dados.planoSaudeValor}
          onChange={(e) => setDados((d) => ({ ...d, planoSaudeValor: e.target.value }))}
          disabled={!dados.planoSaudeAtivo}
          className="w-32 rounded border px-2 py-1 text-sm disabled:opacity-50"
        />
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div>
        <button
          type="button"
          onClick={salvar}
          disabled={pending}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Salvar Benefícios'}
        </button>
      </div>
    </div>
  );
}
