import type { PrismaClient } from '@prisma/client';
import type { ConviteIdentidadeService } from '@/application/ports/ConviteIdentidadeService';
import type { CriarUsuarioInput, CriarUsuarioResultado } from './dtos';
import type { AssociarPerfisUsuarioUseCase } from './AssociarPerfisUsuarioUseCase';
import type { DefinirExcecoesAcessoUsuarioUseCase } from './DefinirExcecoesAcessoUsuarioUseCase';
import type { GerarAcessoInicialUsuarioUseCase } from './GerarAcessoInicialUsuarioUseCase';

/**
 * US-201 — Cadastrar Usuário. Orquestra Clerk + Postgres de forma atômica:
 * cria o convite no Clerk, abre `prisma.$transaction`, chama Associar Perfis (US-202),
 * Definir Exceções (US-203) e Gerar Acesso Inicial (US-204) com o mesmo `tx`, grava
 * o HistoricoOperacao (USUARIO_CRIADO) e comita. Falha no commit ⇒ revogarConvite (compensação).
 *
 * FUNDAÇÃO: stub. Corpo real na Frente B (feat/us-201-criar-usuario).
 */
export class CriarUsuarioUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly convites: ConviteIdentidadeService,
    private readonly associarPerfis: AssociarPerfisUsuarioUseCase,
    private readonly definirExcecoes: DefinirExcecoesAcessoUsuarioUseCase,
    private readonly gerarAcessoInicial: GerarAcessoInicialUsuarioUseCase,
  ) {}

  async execute(_input: CriarUsuarioInput): Promise<CriarUsuarioResultado> {
    throw new Error('CriarUsuarioUseCase: não implementado (Frente B / US-201).');
  }
}
