import type { Cargo, PrismaClient } from '@prisma/client';
import { CamposObrigatoriosCargoError, CodigoCargoGeracaoFalhouError } from '@/domain/plano-contas/errors';
import { gerarProximoCodigoCargo } from '@/domain/plano-contas/gerarCodigoCargo';
import { isUniqueConstraintError } from '@/domain/plano-contas/gerarCodigoProposta';

const MAX_TENTATIVAS_CODIGO = 5;

type CadastrarCargoRascunhoInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  nomeCargoMercado: string;
};

/**
 * ADR-042 — Cargo "Rascunho": cadastro só com o nome, a partir da aba Tabela Salarial
 * (US-131/US-133). Deliberadamente NÃO reaproveita `CadastrarCargoUseCase` — aquele use
 * case continua exigindo Vínculo Funcional (RN_EST_01) e Conta analítica (ADR-027) para
 * o fluxo completo da aba Cargos; este é um caminho separado e mais permissivo, só para
 * o Cargo existir e aparecer no seletor da Tabela Salarial. Fica com `status: RASCUNHO`
 * até ser completado via `EditarCargoUseCase` (transição de mão única).
 */
export class CadastrarCargoRascunhoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CadastrarCargoRascunhoInput): Promise<Cargo> {
    const nome = input.nomeCargoMercado?.trim() ?? '';
    if (nome.length === 0) {
      throw new CamposObrigatoriosCargoError();
    }

    const ano = new Date().getFullYear();

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS_CODIGO; tentativa++) {
      const codigoCargo = await gerarProximoCodigoCargo(this.prisma, input.tenantId, ano);

      try {
        return await this.prisma.$transaction(async (tx) => {
          const cargo = await tx.cargo.create({
            data: {
              tenantId: input.tenantId,
              propostaId: input.propostaId,
              status: 'RASCUNHO',
              nomeCargoMercado: nome,
              codigoCargo,
              // contaId/periodoInicio/salarioMercadoMinimo/salarioMercadoMaximo/fonteAtiva
              // ficam null (ADR-042) — completados depois via EditarCargoUseCase.
              salarioTotal: 0,
            },
          });

          await tx.historicoOperacao.create({
            data: {
              tenantId: input.tenantId,
              usuarioId: input.usuarioId,
              tipoOperacao: 'CARGO_RASCUNHO_CRIADO',
              descricao: `Cargo "${codigoCargo} — ${nome}" cadastrado como Rascunho (Tabela Salarial)`,
              dadosSerializados: { cargoId: cargo.id, propostaId: input.propostaId },
            },
          });

          return cargo;
        });
      } catch (erro) {
        if (isUniqueConstraintError(erro)) continue; // colisão de código — recalcula e tenta de novo
        throw erro;
      }
    }

    throw new CodigoCargoGeracaoFalhouError();
  }
}
