'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SituacaoAcessoUsuario, StatusUsuario } from '@prisma/client';
import type { PerfilAtivo } from '@/application/use-cases/administracao/dtos';
import { BadgeSituacaoAcesso } from './BadgeSituacaoAcesso';
import { CadastrarUsuarioForm } from './CadastrarUsuarioForm';

export type UsuarioLinha = {
  id: string;
  nomeCompleto: string;
  login: string;
  email: string;
  status: StatusUsuario;
  situacaoAcesso: SituacaoAcessoUsuario;
};

type Props = {
  usuarios: UsuarioLinha[];
  perfis: PerfilAtivo[];
};

export function UsuariosClient({ usuarios, perfis }: Props) {
  const router = useRouter();
  const [cadastrando, setCadastrando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  if (cadastrando) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Novo usuário</h2>
        <CadastrarUsuarioForm
          perfis={perfis}
          onSucesso={() => {
            setCadastrando(false);
            setAviso('Usuário cadastrado com sucesso.');
            router.refresh();
          }}
          onCancelar={() => setCadastrando(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {aviso ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
          {aviso}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setAviso(null);
          setCadastrando(true);
        }}
        className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white"
      >
        Novo usuário
      </button>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#DDE2EA] text-left dark:border-[#2B303C]">
              <th className="py-2 pr-4 font-semibold">Nome</th>
              <th className="py-2 pr-4 font-semibold">Login</th>
              <th className="py-2 pr-4 font-semibold">Status</th>
              <th className="py-2 pr-4 font-semibold">Situação de acesso</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-[#8A8F98]">Nenhum usuário cadastrado.</td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="border-b border-[#EEF1F5] dark:border-[#21262F]">
                  <td className="py-2 pr-4">{u.nomeCompleto}</td>
                  <td className="py-2 pr-4">{u.login}</td>
                  <td className="py-2 pr-4">{u.status === 'ATIVO' ? 'Ativo' : 'Inativo'}</td>
                  <td className="py-2 pr-4"><BadgeSituacaoAcesso situacao={u.situacaoAcesso} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
