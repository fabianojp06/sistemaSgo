import { Prisma, type Meta, type PrismaClient } from '@prisma/client';
import {
  CamposObrigatoriosMetaError,
  MetaForaDeEscopoCategoriaError,
  MetaJaExistenteError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';

type CadastrarMetaInput = {
  tenantId: string;
  usuarioId: string;
  versaoId: string;
  tipo: string;
  nome: string;
  status: 'ATIVO' | 'INATIVO';
  observacao?: string | null;
};

/**
 * US-112 — Manter Meta. Meta é 1:1 opcional por VersaoProposta: existe no
 * máximo uma por Versão, só quando a Proposta tem categoria=POR_META.
 * valorGlobal nunca é digitado — é sempre SUM(ValorOrcadoConta.valor) da
 * mesma versão (todos os exercícios) [ORIGEM BLINDADA], recalculado aqui.
 */
export class CadastrarMetaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CadastrarMetaInput): Promise<Meta> {
    const tipo = input.tipo?.trim() ?? '';
    const nome = input.nome?.trim() ?? '';
    if (tipo.length === 0 || nome.length === 0 || !input.status) {
      throw new CamposObrigatoriosMetaError();
    }

    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: input.versaoId, ativa: true },
      include: { proposta: true },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }
    if (versao.status !== 'RASCUNHO' && versao.status !== 'EM_ELABORACAO') {
      throw new VersaoPropostaInvalidaError(
        'Manutenção Rejeitada: este snapshot está homologado e tornou-se permanentemente imutável por ciclo de vida.',
      );
    }
    if (versao.proposta.categoria !== 'POR_META') {
      throw new MetaForaDeEscopoCategoriaError();
    }

    const existente = await this.prisma.meta.findUnique({ where: { versaoId: input.versaoId } });
    if (existente && existente.ativo) {
      throw new MetaJaExistenteError();
    }

    return this.prisma.$transaction(async (tx) => {
      const { _sum } = await tx.valorOrcadoConta.aggregate({
        where: { tenantId: input.tenantId, versaoId: input.versaoId },
        _sum: { valor: true },
      });
      const valorGlobal = _sum.valor ?? new Prisma.Decimal(0);

      const meta = existente
        ? await tx.meta.update({
            where: { id: existente.id },
            data: { tipo, nome, status: input.status, observacao: input.observacao ?? null, valorGlobal, ativo: true },
          })
        : await tx.meta.create({
            data: {
              tenantId: input.tenantId,
              versaoId: input.versaoId,
              tipo,
              nome,
              status: input.status,
              observacao: input.observacao ?? null,
              valorGlobal,
            },
          });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'META_CRIADA',
          descricao: `Meta "${nome}" cadastrada para a Versão ${input.versaoId}`,
          dadosSerializados: { metaId: meta.id, versaoId: input.versaoId, valorGlobal: valorGlobal.toString() },
        },
      });

      return meta;
    });
  }
}
