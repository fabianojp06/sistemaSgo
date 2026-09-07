'use client';

import { useMemo, useState, useTransition } from 'react';
import type { PerfilAtivo, ExcecaoAcessoInput } from '@/application/use-cases/administracao/dtos';
import { criarUsuario } from './actions';
import { PainelPerfisAcesso as PainelPerfisAcessoWrapper } from './PainelPerfisAcesso';
import { PainelExcecoesPerfil as PainelExcecoesWrapper } from './PainelExcecoesPerfil';

type Props = {
  perfis: PerfilAtivo[];
  onSucesso: () => void;
  onCancelar: () => void;
};

const CAMPO =
  'w-full rounded-md border border-[#DDE2EA] bg-white px-3 py-2 text-sm dark:border-[#2B303C] dark:bg-[#191D26]';

export function CadastrarUsuarioForm({ perfis, onSucesso, onCancelar }: Props) {
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [status, setStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [perfisSelecionados, setPerfisSelecionados] = useState<string[]>([]);
  const [excecoes, setExcecoes] = useState<ExcecaoAcessoInput[]>([]);

  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [camposInvalidos, setCamposInvalidos] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const perfilPorId = useMemo(() => new Map(perfis.map((p) => [p.id, p])), [perfis]);
  const perfisSelecionadosObj = perfisSelecionados
    .map((id) => perfilPorId.get(id))
    .filter((p): p is PerfilAtivo => p !== undefined);

  function togglePerfil(perfilId: string) {
    setPerfisSelecionados((atual) => {
      if (atual.includes(perfilId)) {
        setExcecoes((exc) => exc.filter((e) => e.perfilId !== perfilId));
        return atual.filter((id) => id !== perfilId);
      }
      return [...atual, perfilId];
    });
  }

  function toggleFuncionalidade(perfilId: string, funcionalidadeId: string) {
    setExcecoes((atual) => {
      const existe = atual.some((e) => e.perfilId === perfilId && e.funcionalidadeId === funcionalidadeId);
      const proximas = existe
        ? atual.filter((e) => !(e.perfilId === perfilId && e.funcionalidadeId === funcionalidadeId))
        : [...atual, { perfilId, funcionalidadeId }];

      // REQ0081 — se todas as funcionalidades do perfil viraram exceção, desmarca o perfil.
      const perfil = perfilPorId.get(perfilId);
      if (perfil && perfil.funcionalidades.length > 0) {
        const excetuadasDoPerfil = proximas.filter((e) => e.perfilId === perfilId).length;
        if (excetuadasDoPerfil >= perfil.funcionalidades.length) {
          setPerfisSelecionados((sel) => sel.filter((id) => id !== perfilId));
          return proximas.filter((e) => e.perfilId !== perfilId);
        }
      }
      return proximas;
    });
  }

  function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    setErroGeral(null);
    setCamposInvalidos({});

    startTransition(async () => {
      const resultado = await criarUsuario({
        nomeCompleto,
        email,
        login,
        status,
        perfis: perfisSelecionados,
        excecoes,
      });
      if (resultado.sucesso) {
        onSucesso();
        return;
      }
      setErroGeral(resultado.mensagem);
      setCamposInvalidos(resultado.camposInvalidos ?? {});
    });
  }

  return (
    <form onSubmit={submeter} className="max-w-2xl space-y-4">
      {erroGeral ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {erroGeral}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="nomeCompleto" className="text-sm font-medium">Nome completo</label>
          <input id="nomeCompleto" className={CAMPO} value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} required />
          {camposInvalidos.nomeCompleto?.[0] ? <p className="text-xs text-red-600">{camposInvalidos.nomeCompleto[0]}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">E-mail</label>
          <input id="email" type="email" className={CAMPO} value={email} onChange={(e) => setEmail(e.target.value)} required />
          {camposInvalidos.email?.[0] ? <p className="text-xs text-red-600">{camposInvalidos.email[0]}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="login" className="text-sm font-medium">Login</label>
          <input id="login" className={CAMPO} value={login} onChange={(e) => setLogin(e.target.value)} required />
          {camposInvalidos.login?.[0] ? <p className="text-xs text-red-600">{camposInvalidos.login[0]}</p> : null}
        </div>
        <div className="space-y-1">
          <label htmlFor="status" className="text-sm font-medium">Status</label>
          <select id="status" className={CAMPO} value={status} onChange={(e) => setStatus(e.target.value as 'ATIVO' | 'INATIVO')}>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
          </select>
        </div>
      </div>

      <PainelPerfisAcessoWrapper perfis={perfis} selecionados={perfisSelecionados} onToggle={togglePerfil} />
      {camposInvalidos.perfis?.[0] ? <p className="text-xs text-red-600">{camposInvalidos.perfis[0]}</p> : null}

      <PainelExcecoesWrapper perfisSelecionados={perfisSelecionadosObj} excecoes={excecoes} onToggleFuncionalidade={toggleFuncionalidade} />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-md border border-[#DDE2EA] px-4 py-2 text-sm dark:border-[#2B303C]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
