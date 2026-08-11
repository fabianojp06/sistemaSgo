'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  cadastrarProposta,
  duplicarProposta,
  excluirVersaoProposta,
  criarNovaVersaoProposta,
  listarVersoesProposta,
  restaurarVersaoProposta,
  type PropostaListada,
  type VersaoPropostaHistorico,
} from './actions';

const LABEL_TIPO: Record<PropostaListada['tipo'], string> = {
  CONTRATO: 'Contrato',
  TERMO_DE_PARCERIA: 'Termo de Parceria',
};

const LABEL_CATEGORIA: Record<PropostaListada['categoria'], string> = {
  CONSOLIDADA: 'Consolidada',
  POR_META: 'Por Meta',
};

/** Redesign da tela (sessão 2026-08-07, protótipo aprovado): ícone por categoria — accent para
 * Consolidada, roxo para Por Meta — dá reconhecimento visual imediato do que a Proposta contém. */
const CATEGORIA_ICONE: Record<PropostaListada['categoria'], { letra: string; classe: string }> = {
  CONSOLIDADA: {
    letra: 'C',
    classe: 'bg-[#E8EEFC] text-[#2B5FD9] dark:bg-[#1D2A48] dark:text-[#6D93F0]',
  },
  POR_META: {
    letra: 'M',
    classe: 'bg-[#F1ECFE] text-[#8A5CF6] dark:bg-[#2A2340] dark:text-[#B39BF9]',
  },
};

/** StatusProposta: RASCUNHO/EM_ELABORACAO = em construção (âmbar); OFICIALIZADO = vigente (verde);
 * ENCERRADO = finalizado (cinza, mesmo tom de "Excluída" no histórico). */
function pillStatus(status: string): { texto: string; classe: string } {
  if (status === 'OFICIALIZADO') {
    return { texto: status, classe: 'bg-[#E4F6ED] text-[#1F9D66] dark:bg-[#1B3327] dark:text-[#4CC48A]' };
  }
  if (status === 'ENCERRADO') {
    return { texto: status, classe: 'bg-[#EEF0F2] text-[#8A8F98] dark:bg-[#232732] dark:text-[#767C89]' };
  }
  return { texto: status, classe: 'bg-[#FBF0DD] text-[#C98A1E] dark:bg-[#362A14] dark:text-[#E0AE55]' };
}

function NovaPropostaForm({ podeCriar, onCriada }: { podeCriar: boolean; onCriada: () => void }) {
  const anoAtual = new Date().getFullYear();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<PropostaListada['tipo']>('CONTRATO');
  const [nome, setNome] = useState('');
  const [dataInicio, setDataInicio] = useState(`${anoAtual}-01-01`);
  const [dataFim, setDataFim] = useState(`${anoAtual}-12-31`);
  const [categoria, setCategoria] = useState<PropostaListada['categoria']>('CONSOLIDADA');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!podeCriar) return null;

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="self-end rounded-[7px] bg-[#2B5FD9] px-4 py-2 text-sm font-medium text-white hover:brightness-110 dark:bg-[#6D93F0] dark:text-[#12151C]"
      >
        + Nova Proposta
      </button>
    );
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await cadastrarProposta({ tipo, nome, dataInicio, dataFim, categoria });
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setAberto(false);
      setNome('');
      onCriada();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-[#DDE2EA] bg-white p-4 shadow-[0_1px_2px_rgba(20,24,33,0.05),0_1px_1px_rgba(20,24,33,0.04)] dark:border-[#2B303C] dark:bg-[#191D26]">
      <h3 className="font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Nova Proposta</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#5B6270] dark:text-[#A4AAB6]">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as PropostaListada['tipo'])}
            className="w-full rounded border border-[#DDE2EA] bg-white px-2 py-1 text-sm text-[#1A1F29] dark:border-[#2B303C] dark:bg-[#1F2430] dark:text-[#EBEDF2]"
          >
            <option value="CONTRATO">Contrato</option>
            <option value="TERMO_DE_PARCERIA">Termo de Parceria</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#5B6270] dark:text-[#A4AAB6]">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as PropostaListada['categoria'])}
            className="w-full rounded border border-[#DDE2EA] bg-white px-2 py-1 text-sm text-[#1A1F29] dark:border-[#2B303C] dark:bg-[#1F2430] dark:text-[#EBEDF2]"
          >
            <option value="CONSOLIDADA">Consolidada</option>
            <option value="POR_META">Por Meta</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#5B6270] dark:text-[#A4AAB6]">Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded border border-[#DDE2EA] bg-white px-2 py-1 text-sm text-[#1A1F29] dark:border-[#2B303C] dark:bg-[#1F2430] dark:text-[#EBEDF2]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#5B6270] dark:text-[#A4AAB6]">Data Início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full rounded border border-[#DDE2EA] bg-white px-2 py-1 text-sm text-[#1A1F29] dark:border-[#2B303C] dark:bg-[#1F2430] dark:text-[#EBEDF2]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#5B6270] dark:text-[#A4AAB6]">Data Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full rounded border border-[#DDE2EA] bg-white px-2 py-1 text-sm text-[#1A1F29] dark:border-[#2B303C] dark:bg-[#1F2430] dark:text-[#EBEDF2]"
          />
        </div>
      </div>

      {erro && <p className="text-xs text-[#C43D3D] dark:text-[#E0716B]">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={pending || nome.trim().length === 0}
          className="rounded-[7px] bg-[#2B5FD9] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-[#6D93F0] dark:text-[#12151C]"
        >
          {pending ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-[7px] border border-[#DDE2EA] px-3 py-1.5 text-sm text-[#5B6270] dark:border-[#2B303C] dark:text-[#A4AAB6]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ModalConfirmarRestauracao({
  versaoVigenteAtual,
  versaoAlvo,
  pending,
  onConfirmar,
  onCancelar,
}: {
  versaoVigenteAtual: VersaoPropostaHistorico | null;
  versaoAlvo: VersaoPropostaHistorico;
  pending: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-[10px] border border-[#DDE2EA] bg-white p-4 shadow-lg dark:border-[#2B303C] dark:bg-[#191D26]">
        <h3 className="font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Restaurar versão</h3>
        <p className="mt-2 text-sm text-[#5B6270] dark:text-[#A4AAB6]">
          {versaoVigenteAtual
            ? `A versão ${versaoVigenteAtual.numeroVersao} (vigente atual) deixará de ser vigente. `
            : ''}
          Deseja restaurar a versão {versaoAlvo.numeroVersao}?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={pending}
            className="rounded-[7px] border border-[#DDE2EA] px-3 py-1.5 text-sm text-[#5B6270] disabled:opacity-50 dark:border-[#2B303C] dark:text-[#A4AAB6]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={pending}
            className="rounded-[7px] bg-[#2B5FD9] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-[#6D93F0] dark:text-[#12151C]"
          >
            {pending ? 'Restaurando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoricoVersoes({
  propostaId,
  podeRestaurarVersao,
  onRestaurado,
}: {
  propostaId: string;
  podeRestaurarVersao: boolean;
  onRestaurado: () => void;
}) {
  const [versoes, setVersoes] = useState<VersaoPropostaHistorico[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [versaoParaRestaurar, setVersaoParaRestaurar] = useState<VersaoPropostaHistorico | null>(null);
  const [restaurando, startRestaurar] = useTransition();

  function carregar() {
    startTransition(async () => {
      const resposta = await listarVersoesProposta(propostaId);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      setVersoes(resposta.dados);
    });
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaId]);

  function confirmarRestauracao() {
    if (!versaoParaRestaurar) return;
    startRestaurar(async () => {
      const resposta = await restaurarVersaoProposta(propostaId, versaoParaRestaurar.id);
      setVersaoParaRestaurar(null);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      carregar();
      onRestaurado();
    });
  }

  const containerClasse =
    'border-t border-[#DDE2EA] bg-[#EEF1F6] py-2 pr-4 pl-[3.65rem] text-xs dark:border-[#2B303C] dark:bg-[#1F2430]';

  if (pending) return <p className={containerClasse}>Carregando histórico...</p>;
  if (erro) return <p className={`${containerClasse} text-[#C43D3D] dark:text-[#E0716B]`}>{erro}</p>;
  if (!versoes || versoes.length === 0) return <p className={`${containerClasse} text-[#8A8F98] dark:text-[#767C89]`}>Nenhuma versão encontrada.</p>;

  const versaoVigenteAtual = versoes.find((v) => v.vigente) ?? null;

  return (
    <>
      <div className={containerClasse}>
        <ul className="flex flex-col">
          {versoes.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between gap-3 border-b border-dashed border-[#DDE2EA] py-1.5 last:border-none dark:border-[#2B303C]"
            >
              <div className="flex items-center gap-2 text-[#5B6270] dark:text-[#A4AAB6]">
                <span className="font-semibold text-[#1A1F29] tabular-nums dark:text-[#EBEDF2]">v{v.numeroVersao}</span>
                <span>{v.status}</span>
                {v.descricao && <span>{v.descricao}</span>}
                <span className="text-[#8A8F98] dark:text-[#767C89]">
                  {new Date(v.createdAt).toLocaleDateString('pt-BR')} — {v.createdByNome}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {v.vigente ? (
                  <span className="rounded-full bg-[#E4F6ED] px-2 py-0.5 font-semibold text-[#1F9D66] dark:bg-[#1B3327] dark:text-[#4CC48A]">
                    Vigente
                  </span>
                ) : (
                  <>
                    {!v.ativa && (
                      <span className="rounded-full bg-[#EEF0F2] px-2 py-0.5 font-semibold text-[#8A8F98] dark:bg-[#232732] dark:text-[#767C89]">
                        Excluída
                      </span>
                    )}
                    {podeRestaurarVersao && (
                      <button
                        type="button"
                        onClick={() => setVersaoParaRestaurar(v)}
                        className="rounded-[6px] border border-[#DDE2EA] px-2 py-0.5 text-xs text-[#2B5FD9] hover:bg-[#E8EEFC] dark:border-[#2B303C] dark:text-[#6D93F0] dark:hover:bg-[#1D2A48]"
                      >
                        Restaurar
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
      {versaoParaRestaurar && (
        <ModalConfirmarRestauracao
          versaoVigenteAtual={versaoVigenteAtual}
          versaoAlvo={versaoParaRestaurar}
          pending={restaurando}
          onConfirmar={confirmarRestauracao}
          onCancelar={() => setVersaoParaRestaurar(null)}
        />
      )}
    </>
  );
}

function MenuAcoesProposta({
  podeCriarVersao,
  podeDuplicar,
  podeExcluirVersao,
  temVersaoVigente,
  pending,
  onCriarVersao,
  onDuplicar,
  onExcluirVersao,
}: {
  podeCriarVersao: boolean;
  podeDuplicar: boolean;
  podeExcluirVersao: boolean;
  temVersaoVigente: boolean;
  pending: boolean;
  onCriarVersao: () => void;
  onDuplicar: () => void;
  onExcluirVersao: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (ref.current && !ref.current.contains(evento.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  const temAlgumItem = (podeCriarVersao && temVersaoVigente) || podeDuplicar || (podeExcluirVersao && temVersaoVigente);
  if (!temAlgumItem) return null;

  function acionar(fn: () => void) {
    setAberto(false);
    fn();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        disabled={pending}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border border-[#DDE2EA] text-[#5B6270] hover:border-[#5B6270] hover:text-[#1A1F29] disabled:opacity-50 dark:border-[#2B303C] dark:text-[#A4AAB6] dark:hover:border-[#A4AAB6] dark:hover:text-[#EBEDF2]"
      >
        ⋯
      </button>
      {aberto && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-10 flex min-w-[180px] flex-col rounded-[8px] border border-[#DDE2EA] bg-white p-1 shadow-[0_8px_24px_rgba(20,24,33,0.12)] dark:border-[#2B303C] dark:bg-[#191D26]">
          {podeCriarVersao && temVersaoVigente && (
            <button
              type="button"
              onClick={() => acionar(onCriarVersao)}
              className="rounded-[6px] px-2.5 py-2 text-left text-sm text-[#1A1F29] hover:bg-[#EEF1F6] dark:text-[#EBEDF2] dark:hover:bg-[#1F2430]"
            >
              Criar Nova Versão
            </button>
          )}
          {podeDuplicar && (
            <button
              type="button"
              onClick={() => acionar(onDuplicar)}
              className="rounded-[6px] px-2.5 py-2 text-left text-sm text-[#1A1F29] hover:bg-[#EEF1F6] dark:text-[#EBEDF2] dark:hover:bg-[#1F2430]"
            >
              Duplicar Proposta
            </button>
          )}
          {podeExcluirVersao && temVersaoVigente && (
            <>
              <div className="my-1 h-px bg-[#DDE2EA] dark:bg-[#2B303C]" />
              <button
                type="button"
                onClick={() => acionar(onExcluirVersao)}
                className="rounded-[6px] px-2.5 py-2 text-left text-sm text-[#C43D3D] hover:bg-[#EEF1F6] dark:text-[#E0716B] dark:hover:bg-[#1F2430]"
              >
                Excluir Versão
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LinhaProposta({
  proposta,
  podeDuplicar,
  podeExcluirVersao,
  podeCriarVersao,
  podeRestaurarVersao,
  onMudou,
}: {
  proposta: PropostaListada;
  podeDuplicar: boolean;
  podeExcluirVersao: boolean;
  podeCriarVersao: boolean;
  podeRestaurarVersao: boolean;
  onMudou: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [historicoAberto, setHistoricoAberto] = useState(false);

  function duplicar() {
    setErro(null);
    startTransition(async () => {
      const resposta = await duplicarProposta(proposta.id);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      onMudou();
    });
  }

  function excluirVersao() {
    if (!proposta.versaoVigenteId) return;
    setErro(null);
    startTransition(async () => {
      const resposta = await excluirVersaoProposta(proposta.versaoVigenteId!);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      onMudou();
    });
  }

  function criarVersao() {
    setErro(null);
    startTransition(async () => {
      const resposta = await criarNovaVersaoProposta(proposta.id);
      if (!resposta.sucesso) {
        setErro(resposta.mensagem);
        return;
      }
      onMudou();
    });
  }

  const icone = CATEGORIA_ICONE[proposta.categoria];
  const status = pillStatus(proposta.status);

  return (
    <div className="rounded-[10px] border border-[#DDE2EA] bg-white shadow-[0_1px_2px_rgba(20,24,33,0.05),0_1px_1px_rgba(20,24,33,0.04)] dark:border-[#2B303C] dark:bg-[#191D26]">
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <div className={`flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[8px] text-sm font-semibold ${icone.classe}`}>
          {icone.letra}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <Link href={`/propostas/${proposta.id}`} className="text-[0.95rem] font-semibold text-[#1A1F29] hover:text-[#2B5FD9] dark:text-[#EBEDF2] dark:hover:text-[#6D93F0]">
              {proposta.nome}
            </Link>
            <span className="text-[0.72rem] tabular-nums tracking-wide text-[#8A8F98] dark:text-[#767C89]">{proposta.codigo}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[0.75rem] text-[#5B6270] dark:text-[#A4AAB6]">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-[''] ${status.classe}`}>
              {status.texto}
            </span>
            {proposta.versaoVigenteNumero !== null && (
              <span className="tabular-nums text-[#8A8F98] dark:text-[#767C89]">v{proposta.versaoVigenteNumero}</span>
            )}
            <span className="text-[#DDE2EA] dark:text-[#2B303C]">·</span>
            <span className="text-[#8A8F98] dark:text-[#767C89]">
              {LABEL_TIPO[proposta.tipo]} · {LABEL_CATEGORIA[proposta.categoria]}
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoricoAberto((a) => !a)}
            className={`rounded-[7px] border px-2.5 py-1.5 text-xs ${
              historicoAberto
                ? 'border-[#E8EEFC] bg-[#E8EEFC] text-[#2B5FD9] dark:border-[#1D2A48] dark:bg-[#1D2A48] dark:text-[#6D93F0]'
                : 'border-[#DDE2EA] text-[#5B6270] hover:border-[#2B5FD9] hover:text-[#2B5FD9] dark:border-[#2B303C] dark:text-[#A4AAB6] dark:hover:border-[#6D93F0] dark:hover:text-[#6D93F0]'
            }`}
          >
            {historicoAberto ? 'Ocultar Histórico' : 'Histórico'}
          </button>
          <MenuAcoesProposta
            podeCriarVersao={podeCriarVersao}
            podeDuplicar={podeDuplicar}
            podeExcluirVersao={podeExcluirVersao}
            temVersaoVigente={proposta.versaoVigenteId !== null}
            pending={pending}
            onCriarVersao={criarVersao}
            onDuplicar={duplicar}
            onExcluirVersao={excluirVersao}
          />
        </div>
      </div>
      {erro && <p className="px-4 pb-3 text-xs text-[#C43D3D] dark:text-[#E0716B]">{erro}</p>}
      {historicoAberto && (
        <HistoricoVersoes propostaId={proposta.id} podeRestaurarVersao={podeRestaurarVersao} onRestaurado={onMudou} />
      )}
    </div>
  );
}

function SeletorTipoProposta({ onSelecionar }: { onSelecionar: (tipo: PropostaListada['tipo']) => void }) {
  const opcoes: { tipo: PropostaListada['tipo']; descricao: string }[] = [
    { tipo: 'CONTRATO', descricao: 'Propostas vinculadas a Contrato.' },
    { tipo: 'TERMO_DE_PARCERIA', descricao: 'Propostas vinculadas a Termo de Parceria.' },
  ];

  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h2 className="text-[0.95rem] font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Selecione o tipo</h2>
        <p className="mt-0.5 text-sm text-[#5B6270] dark:text-[#A4AAB6]">
          Escolha Contrato ou Termo de Parceria para ver as Propostas correspondentes. É possível trocar depois.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {opcoes.map((opcao) => (
          <button
            key={opcao.tipo}
            type="button"
            onClick={() => onSelecionar(opcao.tipo)}
            className="flex flex-col items-start gap-1 rounded-[10px] border border-[#DDE2EA] bg-white p-4 text-left shadow-[0_1px_2px_rgba(20,24,33,0.05),0_1px_1px_rgba(20,24,33,0.04)] hover:border-[#2B5FD9] dark:border-[#2B303C] dark:bg-[#191D26] dark:hover:border-[#6D93F0]"
          >
            <span className="text-[0.95rem] font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">{LABEL_TIPO[opcao.tipo]}</span>
            <span className="text-xs text-[#5B6270] dark:text-[#A4AAB6]">{opcao.descricao}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** US-114 — Lista de Propostas + ações de Cadastrar/Duplicar/Excluir Versão/Criar Versão/Restaurar
 * (redesign visual da sessão 2026-08-07, mesma lógica de dados).
 * Filtro de tipo (Contrato/Termo de Parceria) é o primeiro passo: nada da lista é exibido antes
 * da escolha, e trocar de tipo exige voltar a esse passo explicitamente. */
export function PropostaListPanel({
  propostasIniciais,
  podeCriar,
  podeDuplicar,
  podeExcluirVersao,
  podeCriarVersao,
  podeRestaurarVersao,
}: {
  propostasIniciais: PropostaListada[];
  podeCriar: boolean;
  podeDuplicar: boolean;
  podeExcluirVersao: boolean;
  podeCriarVersao: boolean;
  podeRestaurarVersao: boolean;
}) {
  const [propostas, setPropostas] = useState(propostasIniciais);
  const [tipoFiltro, setTipoFiltro] = useState<PropostaListada['tipo'] | null>(null);
  const [, startTransition] = useTransition();

  function recarregar() {
    startTransition(async () => {
      const { listarPropostas } = await import('./actions');
      const resposta = await listarPropostas();
      if (resposta.sucesso) setPropostas(resposta.dados);
    });
  }

  if (tipoFiltro === null) {
    return <SeletorTipoProposta onSelecionar={setTipoFiltro} />;
  }

  const propostasFiltradas = propostas.filter((p) => p.tipo === tipoFiltro);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8EEFC] px-2.5 py-1 text-xs font-semibold text-[#2B5FD9] dark:bg-[#1D2A48] dark:text-[#6D93F0]">
            {LABEL_TIPO[tipoFiltro]}
          </span>
          <button
            type="button"
            onClick={() => setTipoFiltro(null)}
            className="text-xs font-medium text-[#5B6270] underline-offset-2 hover:text-[#2B5FD9] hover:underline dark:text-[#A4AAB6] dark:hover:text-[#6D93F0]"
          >
            Trocar filtro
          </button>
        </div>
        <span className="text-[0.825rem] tabular-nums text-[#8A8F98] dark:text-[#767C89]">
          {propostasFiltradas.length} {propostasFiltradas.length === 1 ? 'proposta' : 'propostas'}
        </span>
        <NovaPropostaForm podeCriar={podeCriar} onCriada={recarregar} />
      </div>

      {propostasFiltradas.length === 0 ? (
        <p className="text-sm text-[#8A8F98] dark:text-[#767C89]">Nenhuma Proposta de {LABEL_TIPO[tipoFiltro]} cadastrada ainda.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {propostasFiltradas.map((proposta) => (
            <LinhaProposta
              key={proposta.id}
              proposta={proposta}
              podeDuplicar={podeDuplicar}
              podeExcluirVersao={podeExcluirVersao}
              podeCriarVersao={podeCriarVersao}
              podeRestaurarVersao={podeRestaurarVersao}
              onMudou={recarregar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
