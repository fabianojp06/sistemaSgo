import { Prisma, type Meta, type PrismaClient } from '@prisma/client';
import {
  CamposObrigatoriosMetaError,
  ConflitoConcorrenciaError,
  MetaNaoEncontradaError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';

type EditarMetaInput = {
  tenantId: string;
  usuarioId: string;
  metaId: string;
  tipo?: string;
  nome: string;
  status: 'ATIVO' | 'INATIVO';
  observacao?: string | null;
  /** Cenário 7 — qualquer valorGlobal enviado pelo client é ignorado; sempre recalculado. */
  valorGlobal?: number | null;
  /** US-105 — updatedAt lido pelo cliente antes de editar; se divergir do atual, é conflito. */
  tokenConcorrencia?: Date;
};

/** US-112 — Editar Meta. Tipo é blindado (RN0140); Valor Global sempre recalculado. */
export class EditarMetaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: EditarMetaInput): Promise<Meta> {
    const nome = input.nome?.trim() ?? '';
    if (nome.length === 0 || !input.status) {
      throw new CamposObrigatoriosMetaError();
    }

    const metaAtual = await this.prisma.meta.findFirst({ where: { tenantId: input.tenantId, id: input.metaId } });
    if (!metaAtual) {
      throw new MetaNaoEncontradaError();
    }

    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: metaAtual.versaoId, ativa: true },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }
    if (versao.status !== 'RASCUNHO' && versao.status !== 'EM_ELABORACAO') {
      throw new VersaoPropostaInvalidaError(
        'Manutenção Rejeitada: este snapshot está homologado e tornou-se permanentemente imutável por ciclo de vida.',
      );
    }

    // US-105 — se o cliente informou o token e ele já diverge do estado lido, nem tenta:
    // conflito é certo. Evita abrir transação para uma escrita que vamos rejeitar de qualquer forma.
    if (input.tokenConcorrencia && input.tokenConcorrencia.getTime() !== metaAtual.updatedAt.getTime()) {
      throw new ConflitoConcorrenciaError();
    }

    return this.prisma.$transaction(async (tx) => {
      const { _sum } = await tx.valorOrcadoConta.aggregate({
        where: { tenantId: input.tenantId, versaoId: metaAtual.versaoId },
        _sum: { valor: true },
      });
      const valorGlobal = _sum.valor ?? new Prisma.Decimal(0);

      // Tipo nunca é aceito aqui — RN0140, blindado após a criação.
      // Condição por updatedAt (optimistic locking, US-105) — vale mesmo sem tokenConcorrencia
      // explícito, usando o valor que este próprio use-case acabou de ler.
      const resultado = await tx.meta.updateMany({
        where: { id: input.metaId, updatedAt: metaAtual.updatedAt },
        data: { nome, status: input.status, observacao: input.observacao ?? null, valorGlobal },
      });
      if (resultado.count === 0) {
        throw new ConflitoConcorrenciaError();
      }
      const meta = await tx.meta.findUniqueOrThrow({ where: { id: input.metaId } });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'META_EDITADA',
          descricao: `Meta "${metaAtual.nome} — ${nome}" editada`,
          dadosSerializados: {
            metaId: meta.id,
            valorGlobalAnterior: metaAtual.valorGlobal.toString(),
            valorGlobalNovo: valorGlobal.toString(),
          },
        },
      });

      return meta;
    });
  }
}
