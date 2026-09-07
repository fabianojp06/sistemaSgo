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
 * US-202 — associa 1..N perfis ativos ao usuário dentro da transação de cadastro,
 * validando existência/ativo/tenant e gravando um HistoricoOperacao
 * (USUARIO_PERFIL_ASSOCIADO) por associação (RN0056/RN0078/RN0079/RN0083).
 *
 * FUNDAÇÃO: stub. Corpo real na Frente C (feat/us-202-associar-perfis).
 */
export class AssociarPerfisUsuarioUseCase {
  async execute(_input: AssociarPerfisInput): Promise<void> {
    throw new Error('AssociarPerfisUsuarioUseCase: não implementado (Frente C / US-202).');
  }
}
