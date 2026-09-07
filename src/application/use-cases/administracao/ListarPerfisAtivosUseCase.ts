import type { PrismaClient } from '@prisma/client';
import type { PerfilAtivo } from './dtos';

/**
 * US-202 — lista os perfis ATIVOS do tenant com suas funcionalidades ativas
 * (de módulos ativos), para o painel "Perfil de acesso do usuário" e o painel
 * "Funcionalidade(s) do Perfil" [RN0078].
 */
export class ListarPerfisAtivosUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(tenantId: string): Promise<PerfilAtivo[]> {
    const perfis = await this.prisma.perfil.findMany({
      where: { tenantId, ativo: true },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        descricao: true,
        permissoes: {
          where: { funcionalidade: { ativo: true, modulo: { ativo: true } } },
          select: { funcionalidade: { select: { id: true, chave: true, nome: true } } },
        },
      },
    });

    return perfis.map((perfil) => {
      const vistas = new Set<string>();
      const funcionalidades = perfil.permissoes
        .map((p) => p.funcionalidade)
        .filter((f) => (vistas.has(f.id) ? false : (vistas.add(f.id), true)))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

      return { id: perfil.id, nome: perfil.nome, descricao: perfil.descricao, funcionalidades };
    });
  }
}
