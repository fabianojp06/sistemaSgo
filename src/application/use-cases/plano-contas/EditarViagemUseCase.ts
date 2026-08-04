import type { PrismaClient, Viagem } from '@prisma/client';
import { calcularCustoEstimadoViagem } from '@/domain/plano-contas/calcularCustoEstimadoViagem';
import {
  CamposObrigatoriosViagemError,
  ContaViagemNaoAnaliticaError,
  VersaoPropostaInvalidaError,
  ViagemNaoEncontradaError,
} from '@/domain/plano-contas/errors';

type EditarViagemInput = {
  tenantId: string;
  usuarioId: string;
  viagemId: string;
  descricao: string;
  quantidadePessoas: number;
  mediaDias: number;
  custoUnitarioPassagem: number;
  contaPassagemId: string;
  custoUnitarioDiaria: number;
  contaDiariaId: string;
  custoUnitarioTransporte: number;
  contaTransporteId: string;
};

/**
 * US-109, Cenário 4 — Editar Viagem. Vínculos com Proposta/Versão e Meta são
 * congelados [ORIGEM BLINDADA] — só quantitativos, custos e contas analíticas
 * são editáveis. Custo Estimado sempre recalculado no servidor.
 */
export class EditarViagemUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: EditarViagemInput): Promise<Viagem> {
    const descricao = input.descricao?.trim() ?? '';
    if (
      descricao.length === 0 ||
      descricao.length > 100 ||
      !input.quantidadePessoas ||
      input.quantidadePessoas <= 0 ||
      !input.mediaDias ||
      input.mediaDias <= 0 ||
      !input.contaPassagemId ||
      !input.contaDiariaId ||
      !input.contaTransporteId
    ) {
      throw new CamposObrigatoriosViagemError();
    }

    const viagemAtual = await this.prisma.viagem.findFirst({ where: { tenantId: input.tenantId, id: input.viagemId, ativo: true } });
    if (!viagemAtual) {
      throw new ViagemNaoEncontradaError();
    }

    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: viagemAtual.versaoId, ativa: true },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }
    if (versao.status !== 'RASCUNHO' && versao.status !== 'EM_ELABORACAO') {
      throw new VersaoPropostaInvalidaError(
        'Manutenção Rejeitada: este snapshot está homologado e tornou-se permanentemente imutável por ciclo de vida.',
      );
    }

    const contas = await this.prisma.contaContabil.findMany({
      where: {
        tenantId: input.tenantId,
        id: { in: [input.contaPassagemId, input.contaDiariaId, input.contaTransporteId] },
      },
      select: { id: true, isAnalitica: true },
    });
    const contasPorId = new Map(contas.map((c) => [c.id, c]));
    const todasAnaliticas = [input.contaPassagemId, input.contaDiariaId, input.contaTransporteId].every(
      (id) => contasPorId.get(id)?.isAnalitica === true,
    );
    if (!todasAnaliticas) {
      throw new ContaViagemNaoAnaliticaError();
    }

    const custoEstimado = calcularCustoEstimadoViagem({
      quantidadePessoas: input.quantidadePessoas,
      mediaDias: input.mediaDias,
      custoUnitarioPassagem: input.custoUnitarioPassagem,
      custoUnitarioDiaria: input.custoUnitarioDiaria,
      custoUnitarioTransporte: input.custoUnitarioTransporte,
    });

    return this.prisma.$transaction(async (tx) => {
      const viagem = await tx.viagem.update({
        where: { id: input.viagemId },
        data: {
          descricao,
          quantidadePessoas: input.quantidadePessoas,
          mediaDias: input.mediaDias,
          custoUnitarioPassagem: input.custoUnitarioPassagem,
          contaPassagemId: input.contaPassagemId,
          custoUnitarioDiaria: input.custoUnitarioDiaria,
          contaDiariaId: input.contaDiariaId,
          custoUnitarioTransporte: input.custoUnitarioTransporte,
          contaTransporteId: input.contaTransporteId,
          custoEstimado,
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'VIAGEM_EDITADA',
          descricao: `Viagem "${viagemAtual.descricao} — ${descricao}" editada`,
          dadosSerializados: {
            viagemId: viagem.id,
            custoEstimadoAnterior: viagemAtual.custoEstimado.toString(),
            custoEstimadoNovo: custoEstimado.toString(),
          },
        },
      });

      return viagem;
    });
  }
}
