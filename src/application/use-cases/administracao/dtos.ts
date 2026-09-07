// EP085 / UC02.12 — DTOs compartilhados entre as frentes B/C/D/E. CONGELADO NA FUNDAÇÃO.
import type { Prisma, StatusUsuario, SituacaoAcessoUsuario } from '@prisma/client';

/** Transação Prisma repassada pelo CriarUsuarioUseCase (US-201) aos use-cases C/D/E. */
export type TxCliente = Prisma.TransactionClient;

export type ExcecaoAcessoInput = {
  perfilId: string;
  funcionalidadeId: string;
};

export type CriarUsuarioInput = {
  tenantId: string;
  executorId: string;
  clerkSessionId: string | null;
  ipEstacao: string | null;
  nomeCompleto: string;
  email: string;
  login: string;
  status: StatusUsuario;
  perfis: string[];
  excecoes: ExcecaoAcessoInput[];
};

export type CriarUsuarioResultado = {
  usuarioId: string;
  situacaoAcesso: SituacaoAcessoUsuario;
};

export type PerfilAtivo = {
  id: string;
  nome: string;
  descricao: string | null;
  funcionalidades: { id: string; chave: string; nome: string }[];
};
