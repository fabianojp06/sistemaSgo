import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ConfigurarRateioImpostoUseCase } from './ConfigurarRateioImpostoUseCase';
import {
  ConflitoConcorrenciaError,
  ImpostoNaoDisponivelParaTipoPropostaError,
  ValorOrcadoInvalidoError,
  VersaoOficializadaCongeladaError,
} from '@/domain/plano-contas/errors';

type VersaoMock = {
  id: string;
  tenantId: string;
  status: string;
  ativa: boolean;
  proposta: { tipo: 'CONTRATO' | 'TERMO_DE_PARCERIA' };
};
type AliquotaMock = { id: string; tenantId: string; nome: string; aliquotaPct: Prisma.Decimal; tipoIncidencia: string };
type RateioMock = {
  id: string;
  tenantId: string;
  versaoId: string;
  aliquotaParametroId: string;
  contaId: string;
  competencia: Date;
  valorDeclarado: Prisma.Decimal;
  aliquotaAplicadaSnapshot: Prisma.Decimal;
  ativo: boolean;
  updatedAt: Date;
};

let idSeq = 1;

function criarPrismaMock(versoes: VersaoMock[], aliquotas: AliquotaMock[], rateiosIniciais: Partial<RateioMock>[] = []) {
  const versoesPorId = new Map(versoes.map((v) => [v.id, v]));
  const aliquotasPorId = new Map(aliquotas.map((a) => [a.id, a]));
  const rateios: RateioMock[] = rateiosIniciais.map((r) => ({
    id: r.id ?? `rat-${idSeq++}`,
    tenantId: r.tenantId!,
    versaoId: r.versaoId!,
    aliquotaParametroId: r.aliquotaParametroId!,
    contaId: r.contaId ?? 'conta1',
    competencia: r.competencia!,
    valorDeclarado: r.valorDeclarado!,
    aliquotaAplicadaSnapshot: r.aliquotaAplicadaSnapshot ?? new Prisma.Decimal(0),
    ativo: r.ativo ?? true,
    updatedAt: r.updatedAt ?? new Date('2026-01-01T00:00:00Z'),
  }));

  const chave = (r: Pick<RateioMock, 'tenantId' | 'versaoId' | 'aliquotaParametroId' | 'contaId' | 'competencia'>) =>
    `${r.tenantId}|${r.versaoId}|${r.aliquotaParametroId}|${r.contaId}|${r.competencia.getTime()}`;

  const base = {
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string; ativa: boolean } }) => {
        const v = versoesPorId.get(where.id);
        if (!v || v.tenantId !== where.tenantId || v.ativa !== where.ativa) return Promise.resolve(null);
        return Promise.resolve(v);
      }),
    },
    aliquotaImpostoParametro: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        const a = aliquotasPorId.get(where.id);
        return Promise.resolve(a && a.tenantId === where.tenantId ? a : null);
      }),
    },
    rateioImpostoGrade: {
      findUnique: vi.fn(({ where }: { where: { tenantId_versaoId_aliquotaParametroId_contaId_competencia: RateioMock } }) => {
        const k = chave(where.tenantId_versaoId_aliquotaParametroId_contaId_competencia);
        return Promise.resolve(rateios.find((r) => chave(r) === k) ?? null);
      }),
      create: vi.fn(({ data }: { data: Omit<RateioMock, 'id' | 'updatedAt'> }) => {
        const novo: RateioMock = { id: `rat-${idSeq++}`, updatedAt: new Date(), ...data };
        rateios.push(novo);
        return Promise.resolve(novo);
      }),
      updateMany: vi.fn(({ where, data }: { where: { id: string; updatedAt: Date }; data: Partial<RateioMock> }) => {
        const existente = rateios.find((r) => r.id === where.id);
        if (!existente || existente.updatedAt.getTime() !== where.updatedAt.getTime()) {
          return Promise.resolve({ count: 0 });
        }
        Object.assign(existente, data);
        existente.updatedAt = new Date(existente.updatedAt.getTime() + 1);
        return Promise.resolve({ count: 1 });
      }),
    },
    contaContabil: {
      findFirst: vi.fn().mockResolvedValue({ isAnalitica: true }),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const versaoContratoRascunho: VersaoMock = {
  id: 'v1',
  tenantId: 't1',
  status: 'RASCUNHO',
  ativa: true,
  proposta: { tipo: 'CONTRATO' },
};
const versaoTPRascunho: VersaoMock = { ...versaoContratoRascunho, id: 'v2', proposta: { tipo: 'TERMO_DE_PARCERIA' } };
const versaoOficializada: VersaoMock = { ...versaoContratoRascunho, id: 'v3', status: 'OFICIALIZADO' };

const pis: AliquotaMock = { id: 'a-pis', tenantId: 't1', nome: 'PIS', aliquotaPct: new Prisma.Decimal(9.25), tipoIncidencia: 'CONTRATO' };
const iss: AliquotaMock = { id: 'a-iss', tenantId: 't1', nome: 'ISS', aliquotaPct: new Prisma.Decimal(3.0), tipoIncidencia: 'AMBOS' };

describe('ConfigurarRateioImpostoUseCase [US-101]', () => {
  it('persiste valor com snapshot da alíquota vigente [Cenário 1]', async () => {
    const prisma = criarPrismaMock([versaoContratoRascunho], [pis]);
    const useCase = new ConfigurarRateioImpostoUseCase(prisma as never);

    const resultado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      versaoId: 'v1',
      aliquotaParametroId: 'a-pis',
        contaId: 'conta1',
      competencia: new Date('2026-01-01'),
      valorDeclarado: '1000.00',
    });

    expect(resultado.valorDeclarado.toString()).toBe('1000');
    expect(resultado.aliquotaAplicadaSnapshot.toString()).toBe('9.25');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'RATEIO_IMPOSTO_CONFIGURADO' }) }),
    );
  });

  it('bloqueia valor negativo', async () => {
    const prisma = criarPrismaMock([versaoContratoRascunho], [pis]);
    const useCase = new ConfigurarRateioImpostoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        versaoId: 'v1',
        aliquotaParametroId: 'a-pis',
        contaId: 'conta1',
        competencia: new Date('2026-01-01'),
        valorDeclarado: '-1',
      }),
    ).rejects.toThrow(ValorOrcadoInvalidoError);
  });

  it('bloqueia edição em Versão Oficializada [Cenário 4, Trava o Erro]', async () => {
    const prisma = criarPrismaMock([versaoOficializada], [pis]);
    const useCase = new ConfigurarRateioImpostoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        versaoId: 'v3',
        aliquotaParametroId: 'a-pis',
        contaId: 'conta1',
        competencia: new Date('2026-01-01'),
        valorDeclarado: '100',
      }),
    ).rejects.toThrow(VersaoOficializadaCongeladaError);
  });

  it('bloqueia PIS (CONTRATO-only) em Termo de Parceria [Cenário 5, RN_PRO_010]', async () => {
    const prisma = criarPrismaMock([versaoTPRascunho], [pis]);
    const useCase = new ConfigurarRateioImpostoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        versaoId: 'v2',
        aliquotaParametroId: 'a-pis',
        contaId: 'conta1',
        competencia: new Date('2026-01-01'),
        valorDeclarado: '100',
      }),
    ).rejects.toThrow(ImpostoNaoDisponivelParaTipoPropostaError);
  });

  it('permite ISS (AMBOS) em Termo de Parceria [Cenário 5]', async () => {
    const prisma = criarPrismaMock([versaoTPRascunho], [iss]);
    const useCase = new ConfigurarRateioImpostoUseCase(prisma as never);

    const resultado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      versaoId: 'v2',
      aliquotaParametroId: 'a-iss',
      contaId: 'conta1',
      competencia: new Date('2026-01-01'),
      valorDeclarado: '50',
    });

    expect(resultado.valorDeclarado.toString()).toBe('50');
  });

  it('bloqueia conflito de concorrência quando o token informado diverge do estado atual [Cenário 3, US-105]', async () => {
    const tokenAntigo = new Date('2026-01-01T00:00:00Z');
    const prisma = criarPrismaMock(
      [versaoContratoRascunho],
      [pis],
      [
        {
          tenantId: 't1',
          versaoId: 'v1',
          aliquotaParametroId: 'a-pis',
          competencia: new Date('2026-01-01'),
          valorDeclarado: new Prisma.Decimal(100),
          updatedAt: new Date('2026-02-01T00:00:00Z'),
        },
      ],
    );
    const useCase = new ConfigurarRateioImpostoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        versaoId: 'v1',
        aliquotaParametroId: 'a-pis',
        contaId: 'conta1',
        competencia: new Date('2026-01-01'),
        valorDeclarado: '200',
        tokenConcorrencia: tokenAntigo,
      }),
    ).rejects.toThrow(ConflitoConcorrenciaError);
    expect(prisma.historicoOperacao.create).not.toHaveBeenCalled();
  });

  it('bloqueia conflito detectado só no updateMany (corrida real) [US-105]', async () => {
    const prisma = criarPrismaMock(
      [versaoContratoRascunho],
      [pis],
      [
        {
          tenantId: 't1',
          versaoId: 'v1',
          aliquotaParametroId: 'a-pis',
          competencia: new Date('2026-01-01'),
          valorDeclarado: new Prisma.Decimal(100),
        },
      ],
    );
    prisma.rateioImpostoGrade.updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const useCase = new ConfigurarRateioImpostoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        versaoId: 'v1',
        aliquotaParametroId: 'a-pis',
        contaId: 'conta1',
        competencia: new Date('2026-01-01'),
        valorDeclarado: '200',
      }),
    ).rejects.toThrow(ConflitoConcorrenciaError);
    expect(prisma.historicoOperacao.create).not.toHaveBeenCalled();
  });
});
