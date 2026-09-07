import { prisma } from '@/infrastructure/db/prisma';
import { ClerkIdentidadeUsuarioService } from '@/infrastructure/auth/ClerkIdentidadeUsuarioService';
import { CriarUsuarioUseCase } from './CriarUsuarioUseCase';
import { AssociarPerfisUsuarioUseCase } from './AssociarPerfisUsuarioUseCase';
import { ListarPerfisAtivosUseCase } from './ListarPerfisAtivosUseCase';
import { DefinirExcecoesAcessoUsuarioUseCase } from './DefinirExcecoesAcessoUsuarioUseCase';
import { GerarAcessoInicialUsuarioUseCase } from './GerarAcessoInicialUsuarioUseCase';
import { ReenviarConviteUsuarioUseCase } from './ReenviarConviteUsuarioUseCase';

// FUNDAÇÃO — factories de DI do módulo de Administração / Cadastrar Usuários.
// Cada frente pode adicionar linhas aqui sem conflito (funções independentes).

const identidade = new ClerkIdentidadeUsuarioService();

export function getListarPerfisAtivosUseCase(): ListarPerfisAtivosUseCase {
  return new ListarPerfisAtivosUseCase(prisma);
}

/** US-204 adiada (sem e-mail). Mantido para o contrato. */
export function getReenviarConviteUsuarioUseCase(): ReenviarConviteUsuarioUseCase {
  return new ReenviarConviteUsuarioUseCase(prisma, identidade);
}

export function getCriarUsuarioUseCase(): CriarUsuarioUseCase {
  return new CriarUsuarioUseCase(
    prisma,
    identidade,
    new AssociarPerfisUsuarioUseCase(),
    new DefinirExcecoesAcessoUsuarioUseCase(),
    new GerarAcessoInicialUsuarioUseCase(),
  );
}
