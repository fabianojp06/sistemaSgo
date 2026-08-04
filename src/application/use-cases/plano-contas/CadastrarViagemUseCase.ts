import type { PrismaClient, Viagem } from '@prisma/client';
import { calcularCustoEstimadoViagem } from '@/domain/plano-contas/calcularCustoEstimadoViagem';
import {
  CamposObrigatoriosViagemError,
  ContaViagemNaoAnaliticaError,
  MetaNaoEncontradaError,
  VersaoPropostaInvalidaError,
  ViagemForaDeEscopoCategoriaError,
} from '@/domain/plano-contas/errors';

type CadastrarViagemInput = {
  tenantId: string;
  usuarioId: string;
  versaoId: string;
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
 * US-109, Cenário 1 — Cadastrar Viagem. Exige Proposta categoria=POR_META com
 * Meta ativa cadastrada (US-112); as 3 contas (passagem/diária/transporte)
 * devem ser analíticas [RN_PLA_003]. Custo Estimado sempre calculado no servidor.
 */
export class CadastrarViagemUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CadastrarViagemInput): Promise<Viagem> {
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
      throw new ViagemForaDeEscopoCategoriaError();
    }

    const meta = await this.prisma.meta.findFirst({ where: { tenantId: input.tenantId, versaoId: input.versaoId, ativo: true } });
    if (!meta) {
      throw new MetaNaoEncontradaError();
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
      const viagem = await tx.viagem.create({
        data: {
          tenantId: input.tenantId,
          versaoId: input.versaoId,
          metaId: meta.id,
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
          tipoOperacao: 'VIAGEM_CRIADA',
          descricao: `Viagem "${descricao}" cadastrada para a Versão ${input.versaoId}`,
          dadosSerializados: { viagemId: viagem.id, versaoId: input.versaoId, custoEstimado: custoEstimado.toString() },
        },
      });

      return viagem;
    });
  }
}
