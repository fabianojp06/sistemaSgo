'use client';

import type { PerfilAtivo } from '@/application/use-cases/administracao/dtos';
import type { ExcecaoAcessoInput } from '@/application/use-cases/administracao/dtos';

type Props = {
  perfisSelecionados: PerfilAtivo[];
  /** exceções ativas: pares (perfilId, funcionalidadeId) SEM acesso */
  excecoes: ExcecaoAcessoInput[];
  onToggleFuncionalidade: (perfilId: string, funcionalidadeId: string) => void;
};

/**
 * US-203 — painel "Funcionalidade(s) do Perfil": para cada perfil marcado, mostra
 * as funcionalidades que ele concede. Desmarcar uma cria uma exceção (retira o
 * acesso do usuário). Desmarcar todas de um perfil deve desmarcar o próprio perfil
 * (REQ0081) — tratado no formulário, que observa `excecoes`.
 */
export function PainelExcecoesPerfil({ perfisSelecionados, excecoes, onToggleFuncionalidade }: Props) {
  if (perfisSelecionados.length === 0) return null;

  const semAcesso = new Set(excecoes.map((e) => `${e.perfilId}::${e.funcionalidadeId}`));

  return (
    <fieldset className="rounded-md border border-[#DDE2EA] p-3 dark:border-[#2B303C]">
      <legend className="px-1 text-sm font-semibold">Funcionalidade(s) do Perfil</legend>
      <p className="mb-2 text-xs text-[#8A8F98]">
        Desmarque uma funcionalidade para retirar o acesso deste usuário a ela (exceção de perfil).
      </p>
      <div className="space-y-3">
        {perfisSelecionados.map((perfil) => (
          <div key={perfil.id}>
            <p className="text-sm font-medium">{perfil.nome}</p>
            {perfil.funcionalidades.length === 0 ? (
              <p className="text-xs text-[#8A8F98]">Este perfil não concede funcionalidades ativas.</p>
            ) : (
              <ul className="mt-1 space-y-1 pl-2">
                {perfil.funcionalidades.map((func) => (
                  <li key={func.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!semAcesso.has(`${perfil.id}::${func.id}`)}
                        onChange={() => onToggleFuncionalidade(perfil.id, func.id)}
                      />
                      {func.nome}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
