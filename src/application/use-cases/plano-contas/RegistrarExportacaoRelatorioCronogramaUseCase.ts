import type { PrismaClient } from '@prisma/client';
import { FalhaAuditoriaExportacaoRelatorioError } from '@/domain/plano-contas/errors';

type RegistrarExportacaoRelatorioCronogramaInput = {
  tenantId: string;
  usuarioId: string;
  propostaCodigo: string;
  propostaNome: string;
  formato: 'PDF' | 'XLSX' | 'IMPRESSAO';
  termoAditivoId?: string | null;
  anoExercicio?: number | null;
};

/**
 * US-138 (relatório de Cronograma de Desembolso), Cenário 8/9 — grava a trilha de
 * auditoria em HistoricoOperacao ANTES de o chamador liberar o arquivo para
 * download. Se o INSERT falhar, propaga FalhaAuditoriaExportacaoRelatorioError —
 * é o próprio chamador (Server Action) quem decide travar o download nesse caso.
 */
export class RegistrarExportacaoRelatorioCronogramaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: RegistrarExportacaoRelatorioCronogramaInput): Promise<void> {
    try {
      await this.prisma.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'RELATORIO_CRONOGRAMA_DESEMBOLSO_EXPORTADO',
          descricao: `Exportação (${input.formato}) do Relatório de Cronograma de Desembolso — ${input.propostaCodigo} ${input.propostaNome}`,
          dadosSerializados: {
            propostaCodigo: input.propostaCodigo,
            formato: input.formato,
            termoAditivoId: input.termoAditivoId ?? null,
            anoExercicio: input.anoExercicio ?? null,
          },
        },
      });
    } catch {
      throw new FalhaAuditoriaExportacaoRelatorioError();
    }
  }
}
