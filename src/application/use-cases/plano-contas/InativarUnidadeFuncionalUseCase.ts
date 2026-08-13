import type { PrismaClient } from '@prisma/client';
import {
  InativacaoUnidadeFuncionalBloqueadaError,
  PropostaImutavelError,
  PropostaNaoEncontradaError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';

type InativarUnidadeFuncionalInput = {
  tenantId: string;
  usuarioId: string;
  unidadeId: string;
};

/** US-106, Cenários 5/6 — inativar (soft delete) uma Unidade Funcional. */
export class InativarUnidadeFuncionalUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: InativarUnidadeFuncionalInput): Promise<void> {
    const unidade = await this.prisma.unidadeFuncional.findFirst({
      where: { tenantId: input.tenantId, id: input.unidadeId, ativa: true },
    });
    if (!unidade) {
      throw new VersaoPropostaInvalidaError('Unidade Funcional não encontrada.');
    }

    const proposta = await this.prisma.proposta.findFirst({
      where: { tenantId: input.tenantId, id: unidade.propostaId },
    });
    if (!proposta) {
      throw new PropostaNaoEncontradaError();
    }
    if (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO') {
      throw new PropostaImutavelError();
    }

    const totalCargosVinculados = await this.contarCargosVinculados(input.unidadeId);
    if (totalCargosVinculados > 0) {
      throw new InativacaoUnidadeFuncionalBloqueadaError();
    }

    await this.prisma.$transaction([
      this.prisma.unidadeFuncional.update({
        where: { id: unidade.id },
        data: { ativa: false },
      }),
      this.prisma.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'UNIDADE_FUNCIONAL_INATIVADA',
          descricao: `Unidade Funcional "${unidade.nome}" inativada`,
          dadosSerializados: { propostaId: unidade.propostaId, unidadeId: unidade.id },
        },
      }),
    ]);
  }

  /** RN_EST_04 — bloqueia inativação se houver Cargo vinculado (ADR-043 — vínculo 1:1). */
  private async contarCargosVinculados(unidadeId: string): Promise<number> {
    return this.prisma.cargo.count({ where: { unidadeFuncionalId: unidadeId, ativo: true } });
  }
}
