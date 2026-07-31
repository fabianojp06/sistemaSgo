import { describe, expect, it, vi } from 'vitest';
import { ExcluirVersaoPropostaUseCase } from './ExcluirVersaoPropostaUseCase';
import {
  ExclusaoCicloVidaInvalidoError,
  VersaoUnicaNaoPodeSerExcluidaError,
  VinculosAtivosImpedemExclusaoError,
} from '@/domain/plano-contas/errors';

type VersaoMock = { id: string; tenantId: string; propostaId: string; numeroVersao: number; status: string; ativa: boolean };

function criarPrismaMock(
  versoes: VersaoMock[],
  contadores: { valoresOrcados?: number; rateiosImposto?: number } = {},
) {
  const versoesPorId = new Map(versoes.map((v) => [v.id, { ...v }]));

  const base = {
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string; ativa: boolean } }) => {
        const v = versoesPorId.get(where.id);
        if (!v || v.tenantId !== where.tenantId || v.ativa !== where.ativa) return Promise.resolve(null);
        return Promise.resolve(v);
      }),
      count: vi.fn(({ where }: { where: { tenantId: string; propostaId: string; ativa: boolean } }) =>
        Promise.resolve(
          versoes.filter((v) => v.tenantId === where.tenantId && v.propostaId === where.propostaId && v.ativa === where.ativa)
            .length,
        ),
      ),
      update: vi.fn(({ where, data }: { where: { id: string }; data: { ativa: boolean } }) => {
        const v = versoesPorId.get(where.id);
        if (v) v.ativa = data.ativa;
        return Promise.resolve(v);
      }),
    },
    valorOrcadoConta: { count: vi.fn().mockResolvedValue(contadores.valoresOrcados ?? 0) },
    rateioImpostoGrade: { count: vi.fn().mockResolvedValue(contadores.rateiosImposto ?? 0) },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return base;
}

const versao1: VersaoMock = { id: 'v1', tenantId: 't1', propostaId: 'p1', numeroVersao: 1, status: 'RASCUNHO', ativa: true };
const versao2: VersaoMock = { id: 'v2', tenantId: 't1', propostaId: 'p1', numeroVersao: 2, status: 'RASCUNHO', ativa: true };

describe('ExcluirVersaoPropostaUseCase [US-103]', () => {
  it('exclui (soft delete) versão sem vínculos, quando não é a única ativa [Cenário 1]', async () => {
    const prisma = criarPrismaMock([versao1, versao2]);
    const useCase = new ExcluirVersaoPropostaUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1' });

    expect(prisma.versaoProposta.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { ativa: false } });
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'VERSAO_PROPOSTA_EXCLUIDA' }) }),
    );
  });

  it('bloqueia se houver ValorOrcadoConta vinculado [Cenário 2]', async () => {
    const prisma = criarPrismaMock([versao1, versao2], { valoresOrcados: 2 });
    const useCase = new ExcluirVersaoPropostaUseCase(prisma as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1' })).rejects.toThrow(
      VinculosAtivosImpedemExclusaoError,
    );
    expect(prisma.versaoProposta.update).not.toHaveBeenCalled();
  });

  it('bloqueia se houver RateioImpostoGrade vinculado [Cenário 2]', async () => {
    const prisma = criarPrismaMock([versao1, versao2], { rateiosImposto: 1 });
    const useCase = new ExcluirVersaoPropostaUseCase(prisma as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1' })).rejects.toThrow(
      VinculosAtivosImpedemExclusaoError,
    );
  });

  it('bloqueia exclusão de versão Oficializada [Cenário 3]', async () => {
    const prisma = criarPrismaMock([{ ...versao1, status: 'OFICIALIZADO' }, versao2]);
    const useCase = new ExcluirVersaoPropostaUseCase(prisma as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1' })).rejects.toThrow(
      ExclusaoCicloVidaInvalidoError,
    );
  });

  it('bloqueia exclusão da única versão ativa [Cenário 4]', async () => {
    const prisma = criarPrismaMock([versao1]);
    const useCase = new ExcluirVersaoPropostaUseCase(prisma as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1' })).rejects.toThrow(
      VersaoUnicaNaoPodeSerExcluidaError,
    );
    expect(prisma.versaoProposta.update).not.toHaveBeenCalled();
  });

  it('prioriza o bloqueio de "única versão" sobre o de vínculos, mesmo se ambos se aplicarem', async () => {
    const prisma = criarPrismaMock([versao1], { valoresOrcados: 5 });
    const useCase = new ExcluirVersaoPropostaUseCase(prisma as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1' })).rejects.toThrow(
      VersaoUnicaNaoPodeSerExcluidaError,
    );
    expect(prisma.valorOrcadoConta.count).not.toHaveBeenCalled();
  });
});
