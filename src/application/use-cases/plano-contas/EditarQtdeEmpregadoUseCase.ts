import type { PrismaClient, QtdeEmpregado } from '@prisma/client';
import {
  CamposObrigatoriosQtdeEmpregadoError,
  ConflitoConcorrenciaError,
  PeriodoQtdeEmpregadoForaDaVigenciaError,
  QtdeEmpregadoNaoEncontradaError,
  QtdeEmpregadoPropostaImutavelError,
  SobreposicaoPeriodoQtdeEmpregadoError,
} from '@/domain/plano-contas/errors';
import { calcularValorTotalConsolidado } from '@/domain/plano-contas/calcularValorTotalConsolidado';

type EditarQtdeEmpregadoInput = {
  tenantId: string;
  usuarioId: string;
  qtdeEmpregadoId: string;
  periodoInicio: Date;
  periodoFim: Date;
  numeroDocumento: string;
  /** US-105 — updatedAt lido pelo cliente antes de editar; se divergir do atual, é conflito. */
  tokenConcorrencia?: Date;
};

/**
 * US-113, Cenários 5/6 — Editar Qtde. Empregado. Vínculos com Proposta/Meta
 * são congelados [ORIGEM BLINDADA] — só Período e Número do Documento são
 * editáveis. Quantitativos sempre recalculados no servidor (COUNT ao vivo).
 */
export class EditarQtdeEmpregadoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: EditarQtdeEmpregadoInput): Promise<QtdeEmpregado> {
    const numeroDocumento = input.numeroDocumento?.trim() ?? '';
    if (!input.periodoInicio || !input.periodoFim || numeroDocumento.length === 0) {
      throw new CamposObrigatoriosQtdeEmpregadoError();
    }

    const atual = await this.prisma.qtdeEmpregado.findFirst({
      where: { tenantId: input.tenantId, id: input.qtdeEmpregadoId, ativo: true },
    });
    if (!atual) {
      throw new QtdeEmpregadoNaoEncontradaError();
    }

    const proposta = await this.prisma.proposta.findFirst({ where: { tenantId: input.tenantId, id: atual.propostaId } });
    if (!proposta || (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO')) {
      throw new QtdeEmpregadoPropostaImutavelError();
    }
    if (input.periodoInicio.getTime() < proposta.dataInicio.getTime() || input.periodoFim.getTime() > proposta.dataFim.getTime()) {
      throw new PeriodoQtdeEmpregadoForaDaVigenciaError();
    }

    const existentes = await this.prisma.qtdeEmpregado.findMany({
      where: { tenantId: input.tenantId, propostaId: atual.propostaId, ativo: true, id: { not: input.qtdeEmpregadoId } },
      select: { periodoInicio: true, periodoFim: true },
    });
    const sobrepoe = existentes.some(
      (e) => input.periodoInicio.getTime() <= e.periodoFim.getTime() && input.periodoFim.getTime() >= e.periodoInicio.getTime(),
    );
    if (sobrepoe) {
      throw new SobreposicaoPeriodoQtdeEmpregadoError();
    }

    const escopoContagem = {
      tenantId: input.tenantId,
      propostaId: atual.propostaId,
      ativo: true,
      ...(atual.metaId ? { metaId: atual.metaId } : {}),
    };
    const [quantidadeEmpregados, quantidadeEstagiarios, quantidadeJovemAprendiz, empregadosDoEscopo] = await Promise.all([
      this.prisma.empregadoHeadcount.count({ where: { ...escopoContagem, categoria: 'EMPREGADO' } }),
      this.prisma.empregadoHeadcount.count({ where: { ...escopoContagem, categoria: 'ESTAGIARIO' } }),
      this.prisma.empregadoHeadcount.count({ where: { ...escopoContagem, categoria: 'JOVEM_APRENDIZ' } }),
      this.prisma.empregadoHeadcount.findMany({
        where: escopoContagem,
        select: { periodoInicio: true, periodoFim: true, custoTotalMensal: true },
      }),
    ]);

    const valorTotalConsolidado = calcularValorTotalConsolidado(empregadosDoEscopo, input.periodoInicio, input.periodoFim, proposta.dataFim);

    // US-105 — se o cliente informou o token e ele já diverge do estado lido, nem tenta:
    // conflito é certo. Evita abrir transação para uma escrita que vamos rejeitar de qualquer forma.
    if (input.tokenConcorrencia && input.tokenConcorrencia.getTime() !== atual.updatedAt.getTime()) {
      throw new ConflitoConcorrenciaError();
    }

    return this.prisma.$transaction(async (tx) => {
      // Condição por updatedAt (optimistic locking, US-105) — vale mesmo sem tokenConcorrencia
      // explícito, usando o valor que este próprio use-case acabou de ler.
      const resultado = await tx.qtdeEmpregado.updateMany({
        where: { id: input.qtdeEmpregadoId, updatedAt: atual.updatedAt },
        data: {
          periodoInicio: input.periodoInicio,
          periodoFim: input.periodoFim,
          numeroDocumento,
          quantidadeEmpregados,
          quantidadeEstagiarios,
          quantidadeJovemAprendiz,
          valorTotalConsolidado,
        },
      });
      if (resultado.count === 0) {
        throw new ConflitoConcorrenciaError();
      }
      const qtdeEmpregado = await tx.qtdeEmpregado.findUniqueOrThrow({ where: { id: input.qtdeEmpregadoId } });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'QTDE_EMPREGADO_EDITADA',
          descricao: `Qtde. Empregado "${atual.numeroDocumento} — ${numeroDocumento}" editada`,
          dadosSerializados: {
            qtdeEmpregadoId: qtdeEmpregado.id,
            quantidadeEmpregadosAnterior: atual.quantidadeEmpregados,
            quantidadeEmpregadosNovo: quantidadeEmpregados,
            valorTotalConsolidado: valorTotalConsolidado.toString(),
          },
        },
      });

      return qtdeEmpregado;
    });
  }
}
