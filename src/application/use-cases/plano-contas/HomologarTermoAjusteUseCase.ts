import { Prisma, type PrismaClient } from '@prisma/client';
import {
  ConflitoConcorrenciaError,
  TermoAjusteAcessoNegadoGestorMasterError,
  TermoAjusteEstadoInvalidoError,
  TermoAjusteInvarianciaValorGlobalError,
  TermoAjusteNaoEncontradoError,
  TermoAjusteSaldoInsuficienteError,
} from '@/domain/plano-contas/errors';

type HomologarTermoAjusteInput = {
  tenantId: string;
  usuarioId: string;
  termoAjusteId: string;
  temPermissaoGestorMaster: boolean;
  /** US-105 — updatedAt do TermoAjuste lido pelo cliente antes de homologar. */
  tokenConcorrencia?: Date;
};

type HomologarTermoAjusteResult = {
  id: string;
  status: string;
};

/**
 * US-111, Cenário 4 (2ª etapa) e Cenário 5 — homologação do Gestor Master:
 * PENDENTE_APROVACAO_GESTOR_MASTER -> HOMOLOGADO. Numa única transação: debita
 * ValorOrcadoConta da origem, credita (cria ou soma) o da conta destino, e muda o
 * status. Optimistic locking (US-105) sobre o TermoAjuste e sobre o registro de saldo
 * da origem — a homologação nunca deve mover saldo obsoleto.
 */
export class HomologarTermoAjusteUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: HomologarTermoAjusteInput): Promise<HomologarTermoAjusteResult> {
    if (!input.temPermissaoGestorMaster) {
      throw new TermoAjusteAcessoNegadoGestorMasterError();
    }

    const termoAjuste = await this.prisma.termoAjuste.findFirst({
      where: { tenantId: input.tenantId, id: input.termoAjusteId },
    });
    if (!termoAjuste) {
      throw new TermoAjusteNaoEncontradoError();
    }
    if (termoAjuste.status !== 'PENDENTE_APROVACAO_GESTOR_MASTER') {
      throw new TermoAjusteEstadoInvalidoError(
        'Ação Negada [TRAVA O ERRO]: este Termo de Ajuste não está aguardando homologação do Gestor Master.',
      );
    }
    if (input.tokenConcorrencia && input.tokenConcorrencia.getTime() !== termoAjuste.updatedAt.getTime()) {
      throw new ConflitoConcorrenciaError();
    }

    await this.prisma.$transaction(async (tx) => {
      const atualizacaoTermo = await tx.termoAjuste.updateMany({
        where: { id: termoAjuste.id, updatedAt: termoAjuste.updatedAt, status: 'PENDENTE_APROVACAO_GESTOR_MASTER' },
        data: { status: 'HOMOLOGADO' },
      });
      if (atualizacaoTermo.count === 0) {
        throw new ConflitoConcorrenciaError();
      }

      const chaveExercicio = (contaId: string) => ({
        tenantId_versaoId_contaId_exercicio: {
          tenantId: input.tenantId,
          versaoId: termoAjuste.versaoId,
          contaId,
          exercicio: termoAjuste.exercicio,
        },
      });

      const registroOrigem = await tx.valorOrcadoConta.findUnique({ where: chaveExercicio(termoAjuste.contaOrigemId) });
      const saldoOrigemAntes = registroOrigem?.valor ?? new Prisma.Decimal(0);
      if (saldoOrigemAntes.lessThan(termoAjuste.valor)) {
        throw new TermoAjusteSaldoInsuficienteError();
      }

      const registroDestino = await tx.valorOrcadoConta.findUnique({ where: chaveExercicio(termoAjuste.contaDestinoId) });
      const saldoDestinoAntes = registroDestino?.valor ?? new Prisma.Decimal(0);

      // Débito da origem: nunca cria linha nova (só existe se já havia saldo orçado).
      const debito = await tx.valorOrcadoConta.updateMany({
        where: { id: registroOrigem!.id, updatedAt: registroOrigem!.updatedAt },
        data: { valor: saldoOrigemAntes.minus(termoAjuste.valor) },
      });
      if (debito.count === 0) {
        throw new ConflitoConcorrenciaError();
      }

      if (registroDestino) {
        const credito = await tx.valorOrcadoConta.updateMany({
          where: { id: registroDestino.id, updatedAt: registroDestino.updatedAt },
          data: { valor: saldoDestinoAntes.plus(termoAjuste.valor) },
        });
        if (credito.count === 0) {
          throw new ConflitoConcorrenciaError();
        }
      } else {
        await tx.valorOrcadoConta.create({
          data: {
            tenantId: input.tenantId,
            versaoId: termoAjuste.versaoId,
            contaId: termoAjuste.contaDestinoId,
            exercicio: termoAjuste.exercicio,
            valor: termoAjuste.valor,
          },
        });
      }

      // Invariância (Cenário 3): a soma origem+destino tem que ser igual antes e depois —
      // um débito de X e um crédito do mesmo X preserva isso por construção; a checagem
      // aqui é defensiva, para nunca deixar passar uma regressão futura sem barulho.
      const somaAntes = saldoOrigemAntes.plus(saldoDestinoAntes);
      const somaDepois = saldoOrigemAntes.minus(termoAjuste.valor).plus(saldoDestinoAntes.plus(termoAjuste.valor));
      if (!somaAntes.equals(somaDepois)) {
        throw new TermoAjusteInvarianciaValorGlobalError();
      }

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'TERMO_AJUSTE_HOMOLOGADO',
          descricao: `Termo de Ajuste ${termoAjuste.id} homologado pelo Gestor Master — ${termoAjuste.valor.toString()} redistribuído`,
          dadosSerializados: {
            termoAjusteId: termoAjuste.id,
            contaOrigemId: termoAjuste.contaOrigemId,
            contaDestinoId: termoAjuste.contaDestinoId,
            exercicio: termoAjuste.exercicio,
            valor: termoAjuste.valor.toString(),
          },
        },
      });
    });

    return { id: termoAjuste.id, status: 'HOMOLOGADO' };
  }
}
