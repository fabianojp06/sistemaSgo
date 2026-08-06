import type { PrismaClient, QtdeEmpregado } from '@prisma/client';
import {
  CamposObrigatoriosQtdeEmpregadoError,
  MetaNaoEncontradaError,
  NumeroDocumentoGeracaoFalhouError,
  PeriodoQtdeEmpregadoForaDaVigenciaError,
  PropostaNaoEncontradaError,
  SobreposicaoPeriodoQtdeEmpregadoError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';
import { calcularValorTotalConsolidado } from '@/domain/plano-contas/calcularValorTotalConsolidado';
import { gerarProximoNumeroDocumentoQtdeEmpregado } from '@/domain/plano-contas/gerarNumeroDocumentoQtdeEmpregado';
import { isUniqueConstraintError } from '@/domain/plano-contas/gerarCodigoProposta';

const MAX_TENTATIVAS_NUMERO_DOCUMENTO = 5;

type CadastrarQtdeEmpregadoInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  periodoInicio: Date;
  periodoFim: Date;
};

/**
 * US-113, Cenários 1/2/3/4/8 — Cadastrar Qtde. Empregado. metaId é derivado
 * automaticamente da Meta 1:1 da versão vigente [[Meta]] (mesmo padrão de
 * CadastrarEmpregadoUseCase, ADR-024) — obrigatório só em Proposta POR_META.
 * Quantitativos são ORIGEM BLINDADA: COUNT sobre EmpregadoHeadcount ativo,
 * escopado por propostaId (+ metaId quando POR_META), nunca input direto.
 * numeroDocumento é gerado automaticamente no formato "C-{sequencial}" (3
 * dígitos, por Proposta) — nunca input do usuário.
 */
export class CadastrarQtdeEmpregadoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CadastrarQtdeEmpregadoInput): Promise<QtdeEmpregado> {
    if (!input.periodoInicio || !input.periodoFim) {
      throw new CamposObrigatoriosQtdeEmpregadoError();
    }

    const proposta = await this.prisma.proposta.findFirst({ where: { tenantId: input.tenantId, id: input.propostaId } });
    if (!proposta) {
      throw new PropostaNaoEncontradaError();
    }
    if (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO') {
      throw new VersaoPropostaInvalidaError(
        'Ação Negada [TRAVA O ERRO]: esta Proposta está oficializada e seus dados estão congelados.',
      );
    }
    if (input.periodoInicio.getTime() < proposta.dataInicio.getTime() || input.periodoFim.getTime() > proposta.dataFim.getTime()) {
      throw new PeriodoQtdeEmpregadoForaDaVigenciaError();
    }

    const existentes = await this.prisma.qtdeEmpregado.findMany({
      where: { tenantId: input.tenantId, propostaId: input.propostaId, ativo: true },
      select: { periodoInicio: true, periodoFim: true },
    });
    const sobrepoe = existentes.some(
      (e) => input.periodoInicio.getTime() <= e.periodoFim.getTime() && input.periodoFim.getTime() >= e.periodoInicio.getTime(),
    );
    if (sobrepoe) {
      throw new SobreposicaoPeriodoQtdeEmpregadoError();
    }

    let metaId: string | null = null;
    if (proposta.categoria === 'POR_META') {
      const versaoVigente = await this.prisma.versaoProposta.findFirst({
        where: { tenantId: input.tenantId, propostaId: input.propostaId, vigente: true, ativa: true },
      });
      const meta = versaoVigente
        ? await this.prisma.meta.findFirst({ where: { tenantId: input.tenantId, versaoId: versaoVigente.id, ativo: true } })
        : null;
      if (!meta) {
        throw new MetaNaoEncontradaError();
      }
      metaId = meta.id;
    }

    const escopoContagem = { tenantId: input.tenantId, propostaId: input.propostaId, ativo: true, ...(metaId ? { metaId } : {}) };
    const [quantidadeEmpregados, quantidadeEstagiarios, quantidadeJovemAprendiz, empregadosDoEscopo] = await Promise.all([
      this.prisma.empregadoHeadcount.count({ where: { ...escopoContagem, categoria: 'EMPREGADO' } }),
      this.prisma.empregadoHeadcount.count({ where: { ...escopoContagem, categoria: 'ESTAGIARIO' } }),
      this.prisma.empregadoHeadcount.count({ where: { ...escopoContagem, categoria: 'JOVEM_APRENDIZ' } }),
      this.prisma.empregadoHeadcount.findMany({
        where: escopoContagem,
        select: { periodoInicio: true, periodoFim: true, custoTotalMensal: true },
      }),
    ]);

    // US-113b — snapshot do custo total do período consolidado (overlap por Empregado).
    const valorTotalConsolidado = calcularValorTotalConsolidado(
      empregadosDoEscopo,
      input.periodoInicio,
      input.periodoFim,
      proposta.dataFim,
    );

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS_NUMERO_DOCUMENTO; tentativa++) {
      const numeroDocumento = await gerarProximoNumeroDocumentoQtdeEmpregado(this.prisma, input.tenantId, input.propostaId);

      try {
        return await this.prisma.$transaction(async (tx) => {
          const qtdeEmpregado = await tx.qtdeEmpregado.create({
            data: {
              tenantId: input.tenantId,
              propostaId: input.propostaId,
              metaId,
              periodoInicio: input.periodoInicio,
              periodoFim: input.periodoFim,
              numeroDocumento,
              quantidadeEmpregados,
              quantidadeEstagiarios,
              quantidadeJovemAprendiz,
              valorTotalConsolidado,
            },
          });

          await tx.historicoOperacao.create({
            data: {
              tenantId: input.tenantId,
              usuarioId: input.usuarioId,
              tipoOperacao: 'QTDE_EMPREGADO_CADASTRADA',
              descricao: `Qtde. Empregado "${numeroDocumento}" cadastrada para a Proposta ${input.propostaId}`,
              dadosSerializados: {
                qtdeEmpregadoId: qtdeEmpregado.id,
                propostaId: input.propostaId,
                quantidadeEmpregados,
                quantidadeEstagiarios,
                quantidadeJovemAprendiz,
                valorTotalConsolidado: valorTotalConsolidado.toString(),
              },
            },
          });

          return qtdeEmpregado;
        });
      } catch (erro) {
        if (isUniqueConstraintError(erro)) continue; // colisão de número — recalcula e tenta de novo
        throw erro;
      }
    }

    throw new NumeroDocumentoGeracaoFalhouError();
  }
}
