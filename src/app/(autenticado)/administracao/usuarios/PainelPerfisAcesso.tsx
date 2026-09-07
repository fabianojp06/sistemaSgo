'use client';

import type { PerfilAtivo } from '@/application/use-cases/administracao/dtos';

type Props = {
  perfis: PerfilAtivo[];
  selecionados: string[];
  onToggle: (perfilId: string) => void;
};

/**
 * US-202 — painel "Perfil de acesso do usuário": lista os perfis ativos e deixa o
 * Administrador marcar 1..N. Componente controlado (o estado vive no formulário).
 */
export function PainelPerfisAcesso({ perfis, selecionados, onToggle }: Props) {
  const marcados = new Set(selecionados);

  return (
    <fieldset className="rounded-md border border-[#DDE2EA] p-3 dark:border-[#2B303C]">
      <legend className="px-1 text-sm font-semibold">Perfil de acesso do usuário</legend>
      {perfis.length === 0 ? (
        <p className="text-sm text-[#8A8F98]">Nenhum perfil ativo cadastrado neste tenant.</p>
      ) : (
        <ul className="space-y-1.5">
          {perfis.map((perfil) => (
            <li key={perfil.id}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={marcados.has(perfil.id)}
                  onChange={() => onToggle(perfil.id)}
                />
                <span>
                  <span className="font-medium">{perfil.nome}</span>
                  {perfil.descricao ? (
                    <span className="block text-xs text-[#8A8F98]">{perfil.descricao}</span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
