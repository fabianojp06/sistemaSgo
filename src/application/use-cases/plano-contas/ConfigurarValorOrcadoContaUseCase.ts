import { Prisma, type PrismaClient } from '@prisma/client';
import {
  ValorOrcadoContaSinteticaError,
  ValorOrcadoInvalidoError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';
import { ValorOrcadoTotalizerService } from '@/domain/plano-contas/ValorOrcadoTotalizerService';

type ConfigurarValorOrcadoContaInput = {
  tenantId: string;
  usuarioId: string;
  versaoId: string;
  contaId: string;
  exercicio: number;
  valor: Prisma.Decimal.Value;
};

type ConfigurarValorOrcadoContaResult = {
  contaId: string;
  exercicio: number;
  valor: Prisma.Decimal;
  totaisAncestrais: { contaId: string; total: Prisma.Decimal }[];
};

/**
 * US-007 — Configurar Valor Orçado por Conta Analítica e Exercício.
 * Cenários 1-3 e 6: valida conta analítica + versão editável + valor >= 0,
 * persiste o valor e recalcula (sob demanda, ADR-012) os totais ancestrais,
 * tudo com log de auditoria na mesma transação.
 */
export class ConfigurarValorOrcadoContaUseCase {
  private readonly totalizer: ValorOrcadoTotalizerService;

  constructor(private readonly prisma: PrismaClient) {
    this.totalizer = new ValorOrcadoTotalizerService(prisma);
  }

  async execute(input: ConfigurarValorOrcadoContaInput): Promise<ConfigurarValorOrcadoContaResult> {
    const valor = new Prisma.Decimal(input.valor);
    if (valor.isNaN() || valor.isNegative()) {
      throw new ValorOrcadoInvalidoError();
    }

    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: input.versaoId, ativa: true },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }
    if (versao.status !== 'RASCUNHO' && versao.status !== 'EM_ELABORACAO') {
      throw new VersaoPropostaInvalidaError(
        'Ação Negada [TRAVA O ERRO]: esta versão está oficializada ou encerrada e seus dados estão congelados. Nenhuma alteração é permitida.',
      );
    }

    const conta = await this.prisma.contaContabil.findFirst({
      where: { tenantId: input.tenantId, id: input.contaId },
    });
    if (!conta) {
      throw new VersaoPropostaInvalidaError('Conta contábil não encontrada.');
    }
    if (!conta.isAnalitica) {
      throw new ValorOrcadoContaSinteticaError();
    }

    const registroAnterior = await this.prisma.valorOrcadoConta.findUnique({
      where: {
        tenantId_versaoId_contaId_exercicio: {
          tenantId: input.tenantId,
          versaoId: input.versaoId,
          contaId: input.contaId,
          exercicio: input.exercicio,
        },
      },
    });

    const registro = await this.prisma.$transaction(async (tx) => {
      const salvo = await tx.valorOrcadoConta.upsert({
        where: {
          tenantId_versaoId_contaId_exercicio: {
            tenantId: input.tenantId,
            versaoId: input.versaoId,
            contaId: input.contaId,
            exercicio: input.exercicio,
          },
        },
        create: {
          tenantId: input.tenantId,
          versaoId: input.versaoId,
          contaId: input.contaId,
          exercicio: input.exercicio,
          valor,
        },
        update: { valor },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'VALOR_ORCADO_CONFIGURADO',
          descricao: `Valor orçado da conta "${conta.codigoErp} — ${conta.nomeConta}" configurado para o exercício ${input.exercicio}`,
          dadosSerializados: {
            versaoId: input.versaoId,
            contaId: input.contaId,
            exercicio: input.exercicio,
            valorAnterior: registroAnterior?.valor.toString() ?? null,
            valorNovo: valor.toString(),
          },
        },
      });

      return salvo;
    });

    const ancestrais = await this.totalizer.obterAncestrais(input.tenantId, input.contaId);
    const totais = await this.totalizer.calcularTotais(input.tenantId, input.versaoId, input.exercicio, ancestrais);

    return {
      contaId: registro.contaId,
      exercicio: registro.exercicio,
      valor: registro.valor,
      totaisAncestrais: ancestrais.map((id) => ({ contaId: id, total: totais.get(id) ?? new Prisma.Decimal(0) })),
    };
  }
}
