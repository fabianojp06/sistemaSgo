import { describe, expect, it, vi } from 'vitest';
import { ConfigurarSemaforoContaUseCase } from './ConfigurarSemaforoContaUseCase';
import {
  SemaforoContaSinteticaError,
  SemaforoLimiarAmareloInvalidoError,
  SemaforoLimiarLaranjaInvalidoError,
  SemaforoPercentualForaDaFaixaError,
} from '@/domain/plano-contas/errors';

type ContaMock = {
  id: string;
  tenantId: string;
  codigoErp: string;
  nomeConta: string;
  isAnalitica: boolean;
  semaforoVerdePct: number | null;
  semaforoAmareloPct: number | null;
  semaforoLaranjaPct: number | null;
};

function criarPrismaMock(contas: ContaMock[]) {
  const porId = new Map(contas.map((c) => [c.id, c]));

  return {
    contaContabil: {
      findFirstOrThrow: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        const conta = porId.get(where.id);
        if (!conta || conta.tenantId !== where.tenantId) throw new Error('not found');
        return Promise.resolve(conta);
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<ContaMock> }) =>
        Promise.resolve({ ...porId.get(where.id), ...data }),
      ),
    },
    historicoOperacao: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

const contaAnalitica: ContaMock = {
  id: 'c1',
  tenantId: 't1',
  codigoErp: '1.9.11.001',
  nomeConta: 'Passagens Aéreas Nacionais',
  isAnalitica: true,
  semaforoVerdePct: null,
  semaforoAmareloPct: null,
  semaforoLaranjaPct: null,
};

const contaSintetica: ContaMock = {
  id: 'c2',
  tenantId: 't1',
  codigoErp: '1.9.11',
  nomeConta: 'Viagens',
  isAnalitica: false,
  semaforoVerdePct: null,
  semaforoAmareloPct: null,
  semaforoLaranjaPct: null,
};

describe('ConfigurarSemaforoContaUseCase [US-008]', () => {
  it('configura limiares válidos e grava auditoria [Cenário 1]', async () => {
    const prisma = criarPrismaMock([contaAnalitica]);
    const useCase = new ConfigurarSemaforoContaUseCase(prisma as never);

    await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      contaId: 'c1',
      limiares: { verde: 70, amarelo: 85, laranja: 95 },
    });

    expect(prisma.contaContabil.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { semaforoVerdePct: 70, semaforoAmareloPct: 85, semaforoLaranjaPct: 95 },
    });
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipoOperacao: 'SEMAFORO_CONFIGURADO' }),
      }),
    );
  });

  it('bloqueia Amarelo <= Verde [Cenário 2]', async () => {
    const prisma = criarPrismaMock([contaAnalitica]);
    const useCase = new ConfigurarSemaforoContaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', contaId: 'c1', limiares: { verde: 85, amarelo: 70, laranja: 95 } }),
    ).rejects.toThrow(SemaforoLimiarAmareloInvalidoError);
    expect(prisma.contaContabil.update).not.toHaveBeenCalled();
  });

  it('bloqueia Laranja <= Amarelo [Cenário 2a]', async () => {
    const prisma = criarPrismaMock([contaAnalitica]);
    const useCase = new ConfigurarSemaforoContaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', contaId: 'c1', limiares: { verde: 70, amarelo: 85, laranja: 80 } }),
    ).rejects.toThrow(SemaforoLimiarLaranjaInvalidoError);
  });

  it('bloqueia percentual fora de 1-100 [Cenário 2b]', async () => {
    const prisma = criarPrismaMock([contaAnalitica]);
    const useCase = new ConfigurarSemaforoContaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', contaId: 'c1', limiares: { verde: 0, amarelo: 85, laranja: 95 } }),
    ).rejects.toThrow(SemaforoPercentualForaDaFaixaError);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', contaId: 'c1', limiares: { verde: 70, amarelo: 85, laranja: 101 } }),
    ).rejects.toThrow(SemaforoPercentualForaDaFaixaError);
  });

  it('bloqueia configuração em conta sintética', async () => {
    const prisma = criarPrismaMock([contaSintetica]);
    const useCase = new ConfigurarSemaforoContaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', contaId: 'c2', limiares: { verde: 70, amarelo: 85, laranja: 95 } }),
    ).rejects.toThrow(SemaforoContaSinteticaError);
  });

  it('permite resetar para o padrão global (limiares=null)', async () => {
    const contaComLimiares = { ...contaAnalitica, semaforoVerdePct: 70, semaforoAmareloPct: 85, semaforoLaranjaPct: 95 };
    const prisma = criarPrismaMock([contaComLimiares]);
    const useCase = new ConfigurarSemaforoContaUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', contaId: 'c1', limiares: null });

    expect(prisma.contaContabil.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { semaforoVerdePct: null, semaforoAmareloPct: null, semaforoLaranjaPct: null },
    });
  });
});
