import type { PrismaClient } from '@prisma/client';

export type FuncionalidadeMenu = { chave: string; nome: string };
export type ModuloMenu = { chave: string; nome: string; funcionalidades: FuncionalidadeMenu[] };

/**
 * UC01.03 — monta o menu principal a partir do(s) perfil(is) do usuário [ADR-001, RN0027/RN0030].
 * CA-01.03.02/03 — só entram módulos ativos e funcionalidades ativas; nunca confia em
 * permissão de um módulo desativado, mesmo que o perfil ainda a referencie.
 * CA-01.03.18 — sem nenhum perfil/funcionalidade, retorna lista vazia (fallback E4 é
 * responsabilidade da camada de apresentação).
 */
export class ObterMenuUsuarioUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(tenantId: string, usuarioId: string): Promise<ModuloMenu[]> {
    const permissoes = await this.prisma.usuarioPerfil.findMany({
      where: { tenantId, usuarioId },
      select: {
        perfil: {
          select: {
            permissoes: {
              where: { funcionalidade: { ativo: true, modulo: { ativo: true } } },
              select: {
                funcionalidade: {
                  select: {
                    chave: true,
                    nome: true,
                    modulo: { select: { chave: true, nome: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const modulosPorChave = new Map<string, ModuloMenu>();

    for (const usuarioPerfil of permissoes) {
      for (const permissao of usuarioPerfil.perfil.permissoes) {
        const { modulo, chave, nome } = permissao.funcionalidade;

        let entrada = modulosPorChave.get(modulo.chave);
        if (!entrada) {
          entrada = { chave: modulo.chave, nome: modulo.nome, funcionalidades: [] };
          modulosPorChave.set(modulo.chave, entrada);
        }

        if (!entrada.funcionalidades.some((f) => f.chave === chave)) {
          entrada.funcionalidades.push({ chave, nome });
        }
      }
    }

    return [...modulosPorChave.values()];
  }
}
