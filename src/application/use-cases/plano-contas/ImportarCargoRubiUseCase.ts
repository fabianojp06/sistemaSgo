import type { Cargo, PrismaClient } from '@prisma/client';
import { CargoNaoEncontradoError } from '@/domain/plano-contas/errors';
import type { CandidatoCargoRubi } from '@/infrastructure/integrations/rubi/types';

type ImportarCargoRubiInput = {
  tenantId: string;
  usuarioId: string;
  cargoId: string;
  /** Já escolhido pelo usuário na UI (busca é uma operação de leitura separada). */
  candidato: CandidatoCargoRubi;
};

/**
 * ADR-045 (US-132) — grava, em bloco atômico, os 5 campos [ORIGEM BLINDADA] vindos
 * de um candidato do Rubi escolhido pelo usuário: Nome do Cargo, Tabela
 * Salarial (código+descrição), Faixa (código+descrição), Nível (código+descrição)
 * e Salário Real. Única via de escrita legítima para esses campos — nunca por
 * CadastrarCargoUseCase/EditarCargoUseCase (RN_CAR_03). Reimportação substitui
 * os 5 campos juntos, nunca parcialmente (Cenário 4 da US-132).
 */
export class ImportarCargoRubiUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ImportarCargoRubiInput): Promise<Cargo> {
    const cargoAtual = await this.prisma.cargo.findFirst({
      where: { tenantId: input.tenantId, id: input.cargoId },
    });
    if (!cargoAtual) {
      throw new CargoNaoEncontradoError();
    }

    const { candidato } = input;

    return this.prisma.$transaction(async (tx) => {
      const cargo = await tx.cargo.update({
        where: { id: input.cargoId },
        data: {
          nomeCargoMercado: candidato.nomeCargoMercado,
          tabSalCodigo: candidato.tabSalCodigo,
          tabSalDescricao: candidato.tabSalDescricao,
          faixaCodigo: candidato.faixaCodigo,
          faixaDescricao: candidato.faixaDescricao,
          nivelCodigo: candidato.nivelCodigo,
          nivelDescricao: candidato.nivelDescricao,
          salarioReal: candidato.salarioReal,
          statusSyncSalario: 'SINCRONIZADO',
          syncedAt: new Date(),
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'CARGO_IMPORTADO_RUBI',
          descricao: `Cargo "${cargoAtual.codigoCargo}" importado do Rubi (${candidato.nomeCargoMercado})`,
          dadosSerializados: {
            cargoId: cargo.id,
            anterior: {
              nomeCargoMercado: cargoAtual.nomeCargoMercado,
              tabSalCodigo: cargoAtual.tabSalCodigo,
              tabSalDescricao: cargoAtual.tabSalDescricao,
              faixaCodigo: cargoAtual.faixaCodigo,
              faixaDescricao: cargoAtual.faixaDescricao,
              nivelCodigo: cargoAtual.nivelCodigo,
              nivelDescricao: cargoAtual.nivelDescricao,
              salarioReal: cargoAtual.salarioReal?.toString() ?? null,
            },
            novo: {
              nomeCargoMercado: candidato.nomeCargoMercado,
              tabSalCodigo: candidato.tabSalCodigo,
              tabSalDescricao: candidato.tabSalDescricao,
              faixaCodigo: candidato.faixaCodigo,
              faixaDescricao: candidato.faixaDescricao,
              nivelCodigo: candidato.nivelCodigo,
              nivelDescricao: candidato.nivelDescricao,
              salarioReal: candidato.salarioReal.toString(),
            },
          },
        },
      });

      return cargo;
    });
  }
}
