import type { Prisma, PrismaClient } from '@prisma/client';
import { CredenciaisInvalidasError, SistemaEmManutencaoError, UsuarioBloqueadoError } from '@/domain/auth/errors';
import { deveBloquear } from '@/domain/auth/regras-bloqueio';
import type { ClerkClient } from '@/infrastructure/auth/clerk';
import { ehAdministrador } from '@/infrastructure/auth/clerk';
import { BloquearUsuarioUseCase } from './BloquearUsuarioUseCase';

type AutenticarUsuarioInput = {
  tenantId: string;
  login: string;
  senha: string;
  ipEstacao?: string;
};

type AutenticarUsuarioOutput = {
  usuarioId: string;
  clerkUserId: string;
  signInToken: string;
};

/**
 * UC01.02 — Autenticar Usuário, sob a divisão de responsabilidade Clerk + banco próprio
 * [requisitos/RN_AUTH_Clerk_BancoProprio.md]. Ordem obrigatória [RN0012-rev]:
 *   1. manutenção -> 2. bloqueado -> 3. status -> 4. delega senha ao Clerk -> 5. sincroniza contador/auditoria.
 * A senha NUNCA é verificada antes das etapas 1–3; o Clerk NUNCA é chamado se alguma delas falhar.
 */
export class AutenticarUsuarioUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clerk: ClerkClient,
    private readonly bloquearUsuario: BloquearUsuarioUseCase,
  ) {}

  async execute(input: AutenticarUsuarioInput): Promise<AutenticarUsuarioOutput> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { tenantId: input.tenantId, email: { equals: input.login, mode: 'insensitive' } }, // RN0017 — case insensitive
    });

    if (!usuario) {
      await this.registrarFalha(input.tenantId, null, input.ipEstacao, { loginTentado: input.login });
      throw new CredenciaisInvalidasError();
    }

    const clerkUser = await this.clerk.users.getUser(usuario.clerkUserId);

    const parametros = await this.prisma.parametroSistema.findUnique({ where: { tenantId: input.tenantId } });
    if (parametros?.flagManutencao && !ehAdministrador(clerkUser)) {
      throw new SistemaEmManutencaoError();
    }

    if (usuario.bloqueado) {
      await this.registrarFalha(input.tenantId, usuario.id, input.ipEstacao);
      throw new UsuarioBloqueadoError();
    }

    if (usuario.status === 'INATIVO') {
      await this.registrarFalha(input.tenantId, usuario.id, input.ipEstacao);
      throw new CredenciaisInvalidasError();
    }

    const senhaValida = await this.verificarSenhaNoClerk(usuario.clerkUserId, input.senha);

    if (!senhaValida) {
      await this.processarFalhaDeSenha(input.tenantId, usuario, parametros?.limiteTentativasLogin ?? 5, input.ipEstacao);
      throw new CredenciaisInvalidasError();
    }

    await this.prisma.$transaction([
      this.prisma.usuario.update({ where: { id: usuario.id }, data: { contadorFalhas: 0 } }),
      this.prisma.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: usuario.id,
          tipoOperacao: 'LOGIN_SUCESSO',
          descricao: `Login realizado com sucesso pelo usuário ${usuario.email}`,
          ipEstacao: input.ipEstacao,
        },
      }),
    ]);

    // Curta duração de propósito: o token é trocado pela sessão no client imediatamente após esta resposta.
    const signInToken = await this.clerk.signInTokens.createSignInToken({
      userId: usuario.clerkUserId,
      expiresInSeconds: 60,
    });

    return { usuarioId: usuario.id, clerkUserId: usuario.clerkUserId, signInToken: signInToken.token };
  }

  private async verificarSenhaNoClerk(clerkUserId: string, senha: string): Promise<boolean> {
    try {
      await this.clerk.users.verifyPassword({ userId: clerkUserId, password: senha });
      return true;
    } catch {
      return false;
    }
  }

  private async processarFalhaDeSenha(
    tenantId: string,
    usuario: { id: string; status: 'ATIVO' | 'INATIVO'; contadorFalhas: number },
    limiteTentativasLogin: number,
    ipEstacao?: string,
  ): Promise<void> {
    const contadorAtualizado = usuario.contadorFalhas + 1; // RN0026 — contador global, independe de IP/navegador/horário

    await this.prisma.$transaction([
      this.prisma.usuario.update({ where: { id: usuario.id }, data: { contadorFalhas: contadorAtualizado } }),
      this.prisma.historicoOperacao.create({
        data: {
          tenantId,
          usuarioId: usuario.id,
          tipoOperacao: 'LOGIN_FALHA',
          descricao: 'Tentativa de login inválida',
          ipEstacao,
        },
      }),
    ]);

    if (deveBloquear(contadorAtualizado, limiteTentativasLogin)) {
      await this.bloquearUsuario.execute({
        tenantId,
        usuarioId: usuario.id,
        status: usuario.status,
        quantidadeTentativas: contadorAtualizado,
        ipEstacao,
      });
    }
  }

  private async registrarFalha(
    tenantId: string,
    usuarioId: string | null,
    ipEstacao?: string,
    dadosSerializados?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.historicoOperacao.create({
      data: {
        tenantId,
        usuarioId,
        tipoOperacao: 'LOGIN_FALHA',
        descricao: usuarioId ? 'Tentativa de login inválida' : 'Tentativa de login para identificador inexistente',
        ipEstacao,
        dadosSerializados,
      },
    });
  }
}
