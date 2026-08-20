import { describe, expect, it, vi } from 'vitest';
import { RegistrarExportacaoRelatorioCronogramaUseCase } from './RegistrarExportacaoRelatorioCronogramaUseCase';
import { FalhaAuditoriaExportacaoRelatorioError } from '@/domain/plano-contas/errors';

function criarInput(overrides: Partial<Parameters<RegistrarExportacaoRelatorioCronogramaUseCase['execute']>[0]> = {}) {
  return {
    tenantId: 't1',
    usuarioId: 'u1',
    propostaCodigo: 'TP-001',
    propostaNome: 'Proposta Teste',
    formato: 'PDF' as const,
    ...overrides,
  };
}

describe('RegistrarExportacaoRelatorioCronogramaUseCase [US-138]', () => {
  it('grava RELATORIO_CRONOGRAMA_DESEMBOLSO_EXPORTADO em HistoricoOperacao (Cenário 9)', async () => {
    const prisma = { historicoOperacao: { create: vi.fn().mockResolvedValue({}) } };
    const useCase = new RegistrarExportacaoRelatorioCronogramaUseCase(prisma as never);

    await useCase.execute(criarInput());

    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipoOperacao: 'RELATORIO_CRONOGRAMA_DESEMBOLSO_EXPORTADO', tenantId: 't1', usuarioId: 'u1' }),
      }),
    );
  });

  it('propaga FalhaAuditoriaExportacaoRelatorioError quando o INSERT falha (Cenário 8)', async () => {
    const prisma = { historicoOperacao: { create: vi.fn().mockRejectedValue(new Error('timeout')) } };
    const useCase = new RegistrarExportacaoRelatorioCronogramaUseCase(prisma as never);

    await expect(useCase.execute(criarInput())).rejects.toThrow(FalhaAuditoriaExportacaoRelatorioError);
  });
});
