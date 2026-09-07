import { Prisma, type PrismaClient } from '@prisma/client';
import type { IdentidadeUsuarioService } from '@/application/ports/IdentidadeUsuarioService';
import {
  CamposObrigatoriosUsuarioError,
  EmailInvalidoError,
  EmailJaExisteError,
  LoginJaExisteError,
  UsuarioSemPerfilError,
} from '@/domain/administracao/errors';
import type { CriarUsuarioInput, CriarUsuarioResultado } from './dtos';
import type { AssociarPerfisUsuarioUseCase } from './AssociarPerfisUsuarioUseCase';
import type { DefinirExcecoesAcessoUsuarioUseCase } from './DefinirExcecoesAcessoUsuarioUseCase';
import type { GerarAcessoInicialUsuarioUseCase } from './GerarAcessoInicialUsuarioUseCase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * US-201 — Cadastrar Usuário. Orquestra Clerk (identidade, SEM e-mail) + Postgres:
 *   1. valida e checa unicidade de login/e-mail;
 *   2. cria a identidade no Clerk (fora da transação);
 *   3. `$transaction`: cria o Usuario local, grava USUARIO_CRIADO, associa perfis
 *      (US-202), define exceções (US-203) e o acesso inicial (US-204);
 *   4. falha em qualquer passo do (3) ⇒ `excluirIdentidade` (compensação) + erro.
 */
export class CriarUsuarioUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly identidade: IdentidadeUsuarioService,
    private readonly associarPerfis: AssociarPerfisUsuarioUseCase,
    private readonly definirExcecoes: DefinirExcecoesAcessoUsuarioUseCase,
    private readonly gerarAcessoInicial: GerarAcessoInicialUsuarioUseCase,
  ) {}

  async execute(input: CriarUsuarioInput): Promise<CriarUsuarioResultado> {
    const nomeCompleto = input.nomeCompleto.trim();
    const email = input.email.trim().toLowerCase();
    const login = input.login.trim();
    const perfis = [...new Set(input.perfis)];

    if (!nomeCompleto || !email || !login) throw new CamposObrigatoriosUsuarioError();
    if (!EMAIL_RE.test(email)) throw new EmailInvalidoError();
    if (perfis.length === 0) throw new UsuarioSemPerfilError();

    const [loginEmUso, emailEmUso] = await Promise.all([
      this.prisma.usuario.findFirst({ where: { tenantId: input.tenantId, login }, select: { id: true } }),
      this.prisma.usuario.findFirst({ where: { email }, select: { id: true } }),
    ]);
    if (loginEmUso) throw new LoginJaExisteError();
    if (emailEmUso) throw new EmailJaExisteError();

    const { clerkUserId } = await this.identidade.criarIdentidade({
      tenantId: input.tenantId,
      email,
      nomeCompleto,
      login,
    });

    try {
      const resultado = await this.prisma.$transaction(async (tx) => {
        const usuario = await tx.usuario.upsert({
          where: { clerkUserId },
          create: {
            clerkUserId,
            tenantId: input.tenantId,
            nomeCompleto,
            email,
            login,
            status: input.status,
            situacaoAcesso: 'CONVITE_PENDENTE',
          },
          update: { nomeCompleto, email, login, status: input.status },
        });

        await tx.historicoOperacao.create({
          data: {
            tenantId: input.tenantId,
            usuarioId: input.executorId,
            clerkSessionId: input.clerkSessionId,
            ipEstacao: input.ipEstacao,
            tipoOperacao: 'USUARIO_CRIADO',
            descricao: `Cadastrou o usuário "${nomeCompleto}"`,
            dadosSerializados: { usuarioId: usuario.id, login, email, status: input.status },
          },
        });

        await this.associarPerfis.execute({
          tx,
          tenantId: input.tenantId,
          executorId: input.executorId,
          usuarioId: usuario.id,
          usuarioNome: nomeCompleto,
          perfis,
        });

        await this.definirExcecoes.execute({
          tx,
          tenantId: input.tenantId,
          executorId: input.executorId,
          usuarioId: usuario.id,
          usuarioNome: nomeCompleto,
          perfisAssociados: perfis,
          excecoes: input.excecoes,
        });

        const { situacaoAcesso } = await this.gerarAcessoInicial.execute({
          tx,
          tenantId: input.tenantId,
          executorId: input.executorId,
          usuarioId: usuario.id,
          usuarioNome: nomeCompleto,
        });

        return { usuarioId: usuario.id, situacaoAcesso };
      });

      return resultado;
    } catch (erro) {
      // Compensação — nenhuma conta órfã no Clerk.
      await this.identidade.excluirIdentidade(clerkUserId).catch((compensacaoErro) => {
        console.error('[CriarUsuarioUseCase] falha ao compensar identidade Clerk', compensacaoErro);
      });

      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const alvo = String(erro.meta?.target ?? '');
        if (alvo.includes('login')) throw new LoginJaExisteError();
        if (alvo.includes('email')) throw new EmailJaExisteError();
      }
      throw erro;
    }
  }
}
