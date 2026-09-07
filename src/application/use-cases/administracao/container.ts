import { prisma } from '@/infrastructure/db/prisma';
import { ClerkConviteIdentidadeService } from '@/infrastructure/auth/ClerkConviteIdentidadeService';
import { CriarUsuarioUseCase } from './CriarUsuarioUseCase';
import { AssociarPerfisUsuarioUseCase } from './AssociarPerfisUsuarioUseCase';
import { ListarPerfisAtivosUseCase } from './ListarPerfisAtivosUseCase';
import { DefinirExcecoesAcessoUsuarioUseCase } from './DefinirExcecoesAcessoUsuarioUseCase';
import { GerarAcessoInicialUsuarioUseCase } from './GerarAcessoInicialUsuarioUseCase';
import { ReenviarConviteUsuarioUseCase } from './ReenviarConviteUsuarioUseCase';

// FUNDAÇÃO — factories de DI do módulo de Administração / Cadastrar Usuários.
// Cada frente pode adicionar linhas aqui sem conflito (funções independentes).

const convites = new ClerkConviteIdentidadeService();

export function getListarPerfisAtivosUseCase(): ListarPerfisAtivosUseCase {
  return new ListarPerfisAtivosUseCase(prisma);
}

export function getReenviarConviteUsuarioUseCase(): ReenviarConviteUsuarioUseCase {
  return new ReenviarConviteUsuarioUseCase(prisma, convites);
}

export function getCriarUsuarioUseCase(): CriarUsuarioUseCase {
  return new CriarUsuarioUseCase(
    prisma,
    convites,
    new AssociarPerfisUsuarioUseCase(),
    new DefinirExcecoesAcessoUsuarioUseCase(),
    new GerarAcessoInicialUsuarioUseCase(),
  );
}
