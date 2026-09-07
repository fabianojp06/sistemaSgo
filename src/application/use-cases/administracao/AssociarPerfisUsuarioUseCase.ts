import { PerfilInvalidoError, UsuarioSemPerfilError } from '@/domain/administracao/errors';
import type { TxCliente } from './dtos';

export type AssociarPerfisInput = {
  tx: TxCliente;
  tenantId: string;
  executorId: string;
  usuarioId: string;
  usuarioNome: string;
  perfis: string[];
};

/**
 * US-202 / UC02.14 — associa 1..N perfis ATIVOS ao usuário dentro da transação de
 * cadastro. Valida existência/ativo/tenant de cada perfilId [RN0078], exige ao
 * menos um [RN0079] e grava um HistoricoOperacao (USUARIO_PERFIL_ASSOCIADO) por
 * associação [RN0056]. Um usuário pode ter vários perfis [RN0083].
 */
export class AssociarPerfisUsuarioUseCase {
  async execute(input: AssociarPerfisInput): Promise<void> {
    const perfilIds = [...new Set(input.perfis)];
    if (perfilIds.length === 0) throw new UsuarioSemPerfilError();

    const perfisValidos = await input.tx.perfil.findMany({
      where: { id: { in: perfilIds }, tenantId: input.tenantId, ativo: true },
      select: { id: true, nome: true },
    });
    if (perfisValidos.length !== perfilIds.length) throw new PerfilInvalidoError();

    for (const perfil of perfisValidos) {
      await input.tx.usuarioPerfil.create({
        data: { usuarioId: input.usuarioId, perfilId: perfil.id, tenantId: input.tenantId },
      });
      await input.tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.executorId,
          tipoOperacao: 'USUARIO_PERFIL_ASSOCIADO',
          descricao: `Perfil "${perfil.nome}" associado ao usuário "${input.usuarioNome}"`,
          dadosSerializados: { usuarioId: input.usuarioId, perfilId: perfil.id, perfilNome: perfil.nome },
        },
      });
    }
  }
}
