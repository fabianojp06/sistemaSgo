import { Prisma, type PrismaClient } from '@prisma/client';
import {
  TermoAjusteContaNaoAnaliticaError,
  TermoAjusteMesmaContaError,
  TermoAjusteSaldoInsuficienteError,
  TermoAjusteValorInvalidoError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';

type SolicitarTermoAjusteInput = {
  tenantId: string;
  usuarioId: string;
  versaoId: string;
  contaOrigemId: string;
  contaDestinoId: string;
  exercicio: number;
  valor: Prisma.Decimal.Value;
};

type SolicitarTermoAjusteResult = {
  id: string;
  status: string;
  valor: Prisma.Decimal;
};

/**
 * US-111 (UC03.13, ADR-025) — Cenário 1: solicita um Termo de Ajuste entre duas contas
 * analíticas da mesma versão. Nenhum ValorOrcadoConta é alterado nesta etapa — apenas
 * na homologação (ver HomologarTermoAjusteUseCase). Sem aprovação em cascata aqui:
 * o status nasce PENDENTE_APROVACAO_N1.
 */
export class SolicitarTermoAjusteUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: SolicitarTermoAjusteInput): Promise<SolicitarTermoAjusteResult> {
    const valor = new Prisma.Decimal(input.valor);
    if (valor.isNaN() || valor.lessThanOrEqualTo(0)) {
      throw new TermoAjusteValorInvalidoError();
    }

    if (input.contaOrigemId === input.contaDestinoId) {
      throw new TermoAjusteMesmaContaError();
    }

    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: input.versaoId, ativa: true },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }

    const [contaOrigem, contaDestino] = await Promise.all([
      this.prisma.contaContabil.findFirst({ where: { tenantId: input.tenantId, id: input.contaOrigemId } }),
      this.prisma.contaContabil.findFirst({ where: { tenantId: input.tenantId, id: input.contaDestinoId } }),
    ]);
    if (!contaOrigem || !contaDestino) {
      throw new VersaoPropostaInvalidaError('Conta contábil não encontrada.');
    }
    if (!contaOrigem.isAnalitica || !contaDestino.isAnalitica) {
      throw new TermoAjusteContaNaoAnaliticaError();
    }

    const valorOrigem = await this.prisma.valorOrcadoConta.findUnique({
      where: {
        tenantId_versaoId_contaId_exercicio: {
          tenantId: input.tenantId,
          versaoId: input.versaoId,
          contaId: input.contaOrigemId,
          exercicio: input.exercicio,
        },
      },
    });
    const saldoOrigem = valorOrigem?.valor ?? new Prisma.Decimal(0);
    if (saldoOrigem.lessThan(valor)) {
      throw new TermoAjusteSaldoInsuficienteError();
    }

    const termoAjuste = await this.prisma.$transaction(async (tx) => {
      const criado = await tx.termoAjuste.create({
        data: {
          tenantId: input.tenantId,
          versaoId: input.versaoId,
          contaOrigemId: input.contaOrigemId,
          contaDestinoId: input.contaDestinoId,
          exercicio: input.exercicio,
          valor,
          createdBy: input.usuarioId,
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'TERMO_AJUSTE_SOLICITADO',
          descricao: `Termo de Ajuste solicitado: ${valor.toString()} de "${contaOrigem.codigoErp} — ${contaOrigem.nomeConta}" para "${contaDestino.codigoErp} — ${contaDestino.nomeConta}" (exercício ${input.exercicio})`,
          dadosSerializados: {
            termoAjusteId: criado.id,
            versaoId: input.versaoId,
            contaOrigemId: input.contaOrigemId,
            contaDestinoId: input.contaDestinoId,
            exercicio: input.exercicio,
            valor: valor.toString(),
          },
        },
      });

      return criado;
    });

    return { id: termoAjuste.id, status: termoAjuste.status, valor: termoAjuste.valor };
  }
}
