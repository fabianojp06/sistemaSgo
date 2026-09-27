import type { PrismaClient } from '@prisma/client';
import { FalhaAuditoriaExportacaoRelatorioError } from '@/domain/plano-contas/errors';

type RegistrarExportacaoAnexo6Input = {
  tenantId: string;
  usuarioId: string;
  propostaCodigo: string;
  propostaNome: string;
  formato: 'PDF' | 'XLSX' | 'IMPRESSAO';
  quantidadeCargos: number;
  quantidadeEmpregados: number;
};

/**
 * ANEXO 6 (Composição dos Custos de Remuneração e Benefícios) — mesma regra de
 * auditoria do Relatório de Cronograma de Desembolso (US-138, Cenário 8/9):
 * grava a trilha em HistoricoOperacao ANTES de o chamador liberar o arquivo.
 * Se o INSERT falhar, propaga FalhaAuditoriaExportacaoRelatorioError e quem
 * trava o download é a Server Action.
 */
export class RegistrarExportacaoAnexo6UseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: RegistrarExportacaoAnexo6Input): Promise<void> {
    try {
      await this.prisma.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'RELATORIO_ANEXO6_CUSTO_EMPREGADOS_EXPORTADO',
          descricao: `Exportação (${input.formato}) do ANEXO 6 — Composição dos Custos de Remuneração e Benefícios — ${input.propostaCodigo} ${input.propostaNome}`,
          dadosSerializados: {
            propostaCodigo: input.propostaCodigo,
            formato: input.formato,
            quantidadeCargos: input.quantidadeCargos,
            quantidadeEmpregados: input.quantidadeEmpregados,
          },
        },
      });
    } catch (erro) {
      // A mensagem que chega ao usuário é sempre genérica, mas a causa raiz
      // precisa sobreviver no log: o modo de falha mais provável aqui é a
      // migration do enum TipoOperacao ainda não aplicada em produção, que
      // sem este log vira "falha ao gravar a trilha" sem pista nenhuma.
      console.error('RegistrarExportacaoAnexo6UseCase: falha ao gravar HistoricoOperacao', erro);
      throw new FalhaAuditoriaExportacaoRelatorioError();
    }
  }
}
