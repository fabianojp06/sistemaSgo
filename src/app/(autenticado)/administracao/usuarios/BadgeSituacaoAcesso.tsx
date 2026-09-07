import type { SituacaoAcessoUsuario } from '@prisma/client';

const CONFIG: Record<SituacaoAcessoUsuario, { label: string; classe: string }> = {
  CONVITE_PENDENTE: { label: 'Aguardando 1º acesso', classe: 'bg-amber-100 text-amber-800' },
  CONVITE_ENVIADO: { label: 'Convite enviado', classe: 'bg-blue-100 text-blue-800' },
  FALHA_ENVIO_CONVITE: { label: 'Falha no envio do convite', classe: 'bg-red-100 text-red-800' },
  ACESSO_ATIVO: { label: 'Acesso ativo', classe: 'bg-green-100 text-green-800' },
};

/** EP085/US-204 — badge da situação de acesso do usuário na listagem (UC02.11). */
export function BadgeSituacaoAcesso({ situacao }: { situacao: SituacaoAcessoUsuario }) {
  const { label, classe } = CONFIG[situacao];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${classe}`}>{label}</span>
  );
}
