import { describe, expect, it, vi } from 'vitest';
import { DesativarTributoRateioUseCase } from './DesativarTributoRateioUseCase';
import { VersaoOficializadaCongeladaError } from '@/domain/plano-contas/errors';

function criarPrismaMock() {
  const versao = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true };
  const linhas = [
    { versaoId: 'v1', aliquotaParametroId: 'a-pis', ativo: true },
    { versaoId: 'v1', aliquotaParametroId: 'a-pis', ativo: true },
    { versaoId: 'v1', aliquotaParametroId: 'a-iss', ativo: true },
  ];

  const base = {
    versaoProposta: { findFirst: vi.fn().mockResolvedValue(versao) },
    aliquotaImpostoParametro: { findFirst: vi.fn().mockResolvedValue({ id: 'a-pis', nome: 'PIS' }) },
    rateioImpostoGrade: {
      updateMany: vi.fn(({ where, data }: { where: { versaoId: string; aliquotaParametroId: string }; data: { ativo: boolean } }) => {
        const alvo = linhas.filter((l) => l.versaoId === where.versaoId && l.aliquotaParametroId === where.aliquotaParametroId);
        alvo.forEach((l) => (l.ativo = data.ativo));
        return Promise.resolve({ count: alvo.length });
      }),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base, versao, linhas };
}

describe('DesativarTributoRateioUseCase [US-101, Cenário 3]', () => {
  it('desativa (soft delete) todas as linhas do tributo desmarcado, sem apagar', async () => {
    const { base, linhas } = criarPrismaMock();
    const useCase = new DesativarTributoRateioUseCase(base as never);

    const resultado = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', aliquotaParametroId: 'a-pis' });

    expect(resultado.linhasDesativadas).toBe(2);
    expect(linhas.filter((l) => l.aliquotaParametroId === 'a-pis').every((l) => l.ativo === false)).toBe(true);
    expect(linhas.find((l) => l.aliquotaParametroId === 'a-iss')?.ativo).toBe(true);
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'RATEIO_IMPOSTO_DESATIVADO' }) }),
    );
  });

  it('bloqueia desativação em Versão Oficializada', async () => {
    const { base, versao } = criarPrismaMock();
    versao.status = 'OFICIALIZADO';
    const useCase = new DesativarTributoRateioUseCase(base as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', aliquotaParametroId: 'a-pis' }),
    ).rejects.toThrow(VersaoOficializadaCongeladaError);
  });
});
