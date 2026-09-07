import type { PrismaClient, TipoFuncionalidade } from '@prisma/client';
import { resolverPermissaoEfetiva } from '@/domain/administracao/resolverPermissaoEfetiva';

export type FuncionalidadeMenu = { chave: string; nome: string; tipo: TipoFuncionalidade };
export type ModuloMenu = { chave: string; nome: string; funcionalidades: FuncionalidadeMenu[] };

/**
 * UC01.03 — monta o menu principal a partir do(s) perfil(is) do usuário [ADR-001, RN0027/RN0030].
 * CA-01.03.02/03 — só entram módulos ativos e funcionalidades ativas; nunca confia em
 * permissão de um módulo desativado, mesmo que o perfil ainda a referencie.
 * CA-01.03.18 — sem nenhum perfil/funcionalidade, retorna lista vazia (fallback E4 é
 * responsabilidade da camada de apresentação).
 *
 * EP085/US-203 — a permissão concedida pelos perfis passa por `resolverPermissaoEfetiva`,
 * que subtrai as exceções por usuário (UsuarioPerfilExcecao). FUNDAÇÃO: `excecoes` = []
 * (passthrough — comportamento idêntico ao anterior). A Frente D popula as exceções reais.
 */
export class ObterMenuUsuarioUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(tenantId: string, usuarioId: string): Promise<ModuloMenu[]> {
    const permissoes = await this.prisma.usuarioPerfil.findMany({
      where: { tenantId, usuarioId },
      select: {
        perfilId: true,
        perfil: {
          select: {
            permissoes: {
              where: { funcionalidade: { ativo: true, modulo: { ativo: true } } },
              select: {
                funcionalidade: {
                  select: {
                    id: true,
                    chave: true,
                    nome: true,
                    tipo: true,
                    modulo: { select: { chave: true, nome: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    type Concedida = {
      perfilId: string;
      funcionalidadeId: string;
      chave: string;
      nome: string;
      tipo: TipoFuncionalidade;
      moduloChave: string;
      moduloNome: string;
    };

    const concedidas: Concedida[] = [];
    for (const usuarioPerfil of permissoes) {
      for (const permissao of usuarioPerfil.perfil.permissoes) {
        const f = permissao.funcionalidade;
        concedidas.push({
          perfilId: usuarioPerfil.perfilId,
          funcionalidadeId: f.id,
          chave: f.chave,
          nome: f.nome,
          tipo: f.tipo,
          moduloChave: f.modulo.chave,
          moduloNome: f.modulo.nome,
        });
      }
    }

    // EP085/US-203 — exceções por usuário entram aqui (hoje vazio: passthrough).
    const efetivas = resolverPermissaoEfetiva(concedidas, []);

    const modulosPorChave = new Map<string, ModuloMenu>();
    for (const item of efetivas) {
      let entrada = modulosPorChave.get(item.moduloChave);
      if (!entrada) {
        entrada = { chave: item.moduloChave, nome: item.moduloNome, funcionalidades: [] };
        modulosPorChave.set(item.moduloChave, entrada);
      }
      if (!entrada.funcionalidades.some((f) => f.chave === item.chave)) {
        entrada.funcionalidades.push({ chave: item.chave, nome: item.nome, tipo: item.tipo });
      }
    }

    return [...modulosPorChave.values()];
  }
}
