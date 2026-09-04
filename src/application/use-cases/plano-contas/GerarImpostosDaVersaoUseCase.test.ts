import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { GerarImpostosDaVersaoUseCase } from './GerarImpostosDaVersaoUseCase';
import {
  SemBaseParaGerarImpostosError,
  VersaoOficializadaCongeladaError,
} from '@/domain/plano-contas/errors';

const D = (n: number | string) => new Prisma.Decimal(n);
const DATA_INICIO = new Date('2026-01-01T00:00:00Z');

type AliquotaMock = {
  id: string;
  nome: string;
  aliquotaPct: Prisma.Decimal;
  categoria: 'TRIBUTO' | 'INDICE_REAJUSTE';
  tipoIncidencia: 'CONTRATO' | 'TERMO_DE_PARCERIA' | 'AMBOS';
};

type RateioMock = {
  id: string;
  tenantId: string;
  versaoId: string;
  aliquotaParametroId: string;
  contaId: string;
  competencia: Date;
  valorDeclarado: Prisma.Decimal;
  valorBaseSnapshot: Prisma.Decimal | null;
  aliquotaAplicadaSnapshot: Prisma.Decimal;
  modoValor: 'DECLARADO' | 'CALCULADO';
  ativo: boolean;
  updatedAt: Date;
};

let seq = 1;

function criarPrismaMock(opts: {
  tipoProposta?: 'CONTRATO' | 'TERMO_DE_PARCERIA';
  statusVersao?: string;
  itens?: { contaId: string; valorTotal: Prisma.Decimal }[];
  aliquotas?: AliquotaMock[];
  rateios?: Partial<RateioMock>[];
}) {
  const aliquotas = opts.aliquotas ?? [];
  const aliqPorId = new Map(aliquotas.map((a) => [a.id, a]));
  const rateios: RateioMock[] = (opts.rateios ?? []).map((r) => ({
    id: r.id ?? `rat-${seq++}`,
    tenantId: r.tenantId ?? 't1',
    versaoId: r.versaoId ?? 'v1',
    aliquotaParametroId: r.aliquotaParametroId!,
    contaId: r.contaId!,
    competencia: r.competencia ?? DATA_INICIO,
    valorDeclarado: r.valorDeclarado ?? D(0),
    valorBaseSnapshot: r.valorBaseSnapshot ?? null,
    aliquotaAplicadaSnapshot: r.aliquotaAplicadaSnapshot ?? D(0),
    modoValor: r.modoValor ?? 'DECLARADO',
    ativo: r.ativo ?? true,
    updatedAt: r.updatedAt ?? new Date('2026-01-01T00:00:00Z'),
  }));

  const uniq = (r: Pick<RateioMock, 'tenantId' | 'versaoId' | 'aliquotaParametroId' | 'contaId' | 'competencia'>) =>
    `${r.tenantId}|${r.versaoId}|${r.aliquotaParametroId}|${r.contaId}|${r.competencia.getTime()}`;

  const base = {
    versaoProposta: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'v1',
        tenantId: 't1',
        status: opts.statusVersao ?? 'RASCUNHO',
        ativa: true,
        propostaId: 'p1',
        proposta: {
          tipo: opts.tipoProposta ?? 'CONTRATO',
          dataInicio: DATA_INICIO,
          dataFim: new Date('2026-12-31T00:00:00Z'),
        },
      }),
    },
    viagem: { findMany: vi.fn().mockResolvedValue([]) },
    itemPatrimonial: { findMany: vi.fn().mockResolvedValue(opts.itens ?? []) },
    empregadoHeadcount: { findMany: vi.fn().mockResolvedValue([]) },
    aliquotaImpostoParametro: {
      findMany: vi.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(where.id.in.map((id) => aliqPorId.get(id)).filter(Boolean)),
      ),
    },
    rateioImpostoGrade: {
      findMany: vi.fn(() => Promise.resolve(rateios.filter((r) => r.ativo))),
      findUnique: vi.fn(({ where }: { where: { tenantId_versaoId_aliquotaParametroId_contaId_competencia: RateioMock } }) => {
        const k = uniq(where.tenantId_versaoId_aliquotaParametroId_contaId_competencia);
        return Promise.resolve(rateios.find((r) => uniq(r) === k) ?? null);
      }),
      updateMany: vi.fn(({ where, data }: { where: Partial<RateioMock>; data: Partial<RateioMock> }) => {
        let count = 0;
        for (const r of rateios) {
          const match =
            (where.tenantId === undefined || r.tenantId === where.tenantId) &&
            (where.versaoId === undefined || r.versaoId === where.versaoId) &&
            (where.aliquotaParametroId === undefined || r.aliquotaParametroId === where.aliquotaParametroId) &&
            (where.contaId === undefined || r.contaId === where.contaId) &&
            (where.modoValor === undefined || r.modoValor === where.modoValor) &&
            (where.ativo === undefined || r.ativo === where.ativo);
          if (match) {
            Object.assign(r, data);
            count++;
          }
        }
        return Promise.resolve({ count });
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<RateioMock> }) => {
        const r = rateios.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        r.updatedAt = new Date();
        return Promise.resolve(r);
      }),
      create: vi.fn(({ data }: { data: Omit<RateioMock, 'id' | 'updatedAt'> }) => {
        const novo: RateioMock = { id: `rat-${seq++}`, updatedAt: new Date(), ...data };
        rateios.push(novo);
        return Promise.resolve(novo);
      }),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
    __rateios: rateios,
  };
  return base;
}

const pis: AliquotaMock = { id: 'a-pis', nome: 'PIS', aliquotaPct: D('9.25'), categoria: 'TRIBUTO', tipoIncidencia: 'CONTRATO' };
const iss: AliquotaMock = { id: 'a-iss', nome: 'ISS', aliquotaPct: D('3.00'), categoria: 'TRIBUTO', tipoIncidencia: 'AMBOS' };
const ipca: AliquotaMock = { id: 'a-ipca', nome: 'IPCA', aliquotaPct: D('4.5'), categoria: 'INDICE_REAJUSTE', tipoIncidencia: 'AMBOS' };

const exec = (prisma: ReturnType<typeof criarPrismaMock>) =>
  new GerarImpostosDaVersaoUseCase(prisma as never).execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1' });

describe('GerarImpostosDaVersaoUseCase [US-144 / ADR-050]', () => {
  it('Cenário 1 — gera linha CALCULADO = base × alíquota% (Half-Even)', async () => {
    const prisma = criarPrismaMock({
      itens: [{ contaId: 'c-3101', valorTotal: D('200000.00') }],
      aliquotas: [pis],
      rateios: [{ aliquotaParametroId: 'a-pis', contaId: 'c-3101', modoValor: 'DECLARADO', valorDeclarado: D(0) }],
    });
    // a linha inicial DECLARADO precisa não colidir: coloco-a numa competência diferente
    prisma.__rateios[0].competencia = new Date('2026-06-01T00:00:00Z');

    const r = await exec(prisma);

    expect(r.linhasGeradas).toBe(1);
    expect(r.valorTotalImposto).toBe('18500.00');
    const calc = prisma.__rateios.find((x) => x.modoValor === 'CALCULADO' && x.ativo)!;
    expect(calc.valorDeclarado.toFixed(2)).toBe('18500.00');
    expect(calc.valorBaseSnapshot?.toFixed(2)).toBe('200000.00');
    expect(calc.competencia.getTime()).toBe(DATA_INICIO.getTime());
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'IMPOSTOS_GERADOS' }) }),
    );
  });

  it('Cenário 2 — dois tributos na mesma conta somam sem cascata (mesma base bruta)', async () => {
    const prisma = criarPrismaMock({
      itens: [{ contaId: 'c-3102', valorTotal: D('100000.00') }],
      aliquotas: [pis, iss],
      rateios: [
        { aliquotaParametroId: 'a-pis', contaId: 'c-3102', modoValor: 'CALCULADO', competencia: DATA_INICIO },
        { aliquotaParametroId: 'a-iss', contaId: 'c-3102', modoValor: 'CALCULADO', competencia: DATA_INICIO },
      ],
    });

    const r = await exec(prisma);

    expect(r.linhasGeradas).toBe(2);
    const ativos = prisma.__rateios.filter((x) => x.ativo && x.modoValor === 'CALCULADO');
    expect(ativos.map((x) => x.valorDeclarado.toFixed(2)).sort()).toEqual(['3000.00', '9250.00']);
    expect(ativos.every((x) => x.valorBaseSnapshot?.toFixed(2) === '100000.00')).toBe(true);
  });

  it('Cenário 3 — regerar substitui só CALCULADO e preserva DECLARADO manual', async () => {
    const prisma = criarPrismaMock({
      itens: [{ contaId: 'c-3101', valorTotal: D('220000.00') }],
      aliquotas: [pis, iss],
      rateios: [
        { id: 'pis-old', aliquotaParametroId: 'a-pis', contaId: 'c-3101', modoValor: 'CALCULADO', competencia: DATA_INICIO, valorDeclarado: D('18500.00') },
        { id: 'iss-manual', aliquotaParametroId: 'a-iss', contaId: 'c-3101', modoValor: 'DECLARADO', competencia: new Date('2026-03-01T00:00:00Z'), valorDeclarado: D('5000.00') },
      ],
    });

    const r = await exec(prisma);

    const pisAtivo = prisma.__rateios.filter((x) => x.aliquotaParametroId === 'a-pis' && x.ativo);
    expect(pisAtivo).toHaveLength(1);
    expect(pisAtivo[0].valorDeclarado.toFixed(2)).toBe('20350.00');
    const issManual = prisma.__rateios.find((x) => x.id === 'iss-manual')!;
    expect(issManual.ativo).toBe(true);
    expect(issManual.modoValor).toBe('DECLARADO');
    expect(issManual.valorDeclarado.toFixed(2)).toBe('5000.00');
    expect(r.linhasGeradas).toBe(2); // PIS recalculado + ISS calculado sobre 220k
  });

  it('Cenário 4 — Termo de Parceria pula PIS/COFINS (tipoIncidencia CONTRATO)', async () => {
    const prisma = criarPrismaMock({
      tipoProposta: 'TERMO_DE_PARCERIA',
      itens: [{ contaId: 'c-x', valorTotal: D('100000.00') }],
      aliquotas: [pis, iss],
      rateios: [
        { aliquotaParametroId: 'a-pis', contaId: 'c-x', modoValor: 'DECLARADO', competencia: new Date('2026-07-01T00:00:00Z') },
        { aliquotaParametroId: 'a-iss', contaId: 'c-x', modoValor: 'DECLARADO', competencia: new Date('2026-07-01T00:00:00Z') },
      ],
    });

    const r = await exec(prisma);

    expect(r.linhasGeradas).toBe(1);
    expect(r.porLinha[0].aliquotaNome).toBe('ISS');
  });

  it('Cenário 5 — alíquota INDICE_REAJUSTE nunca gera imposto', async () => {
    const prisma = criarPrismaMock({
      itens: [{ contaId: 'c-y', valorTotal: D('100000.00') }],
      aliquotas: [ipca, iss],
      rateios: [
        { aliquotaParametroId: 'a-ipca', contaId: 'c-y', modoValor: 'DECLARADO', competencia: new Date('2026-05-01T00:00:00Z') },
        { aliquotaParametroId: 'a-iss', contaId: 'c-y', modoValor: 'DECLARADO', competencia: new Date('2026-05-01T00:00:00Z') },
      ],
    });

    const r = await exec(prisma);

    expect(r.porLinha.every((l) => l.aliquotaNome !== 'IPCA')).toBe(true);
    expect(r.linhasGeradas).toBe(1);
  });

  it('Cenário 6 — Versão OFICIALIZADO bloqueia [TRAVA O ERRO]', async () => {
    const prisma = criarPrismaMock({
      statusVersao: 'OFICIALIZADO',
      itens: [{ contaId: 'c-z', valorTotal: D('1000') }],
      aliquotas: [iss],
      rateios: [{ aliquotaParametroId: 'a-iss', contaId: 'c-z' }],
    });

    await expect(exec(prisma)).rejects.toThrow(VersaoOficializadaCongeladaError);
    expect(prisma.historicoOperacao.create).not.toHaveBeenCalled();
  });

  it('Cenário 7 — conta com base zero não gera linha', async () => {
    const prisma = criarPrismaMock({
      itens: [], // nenhum custo
      aliquotas: [iss],
      rateios: [{ aliquotaParametroId: 'a-iss', contaId: 'c-reserva', modoValor: 'DECLARADO', competencia: new Date('2026-08-01T00:00:00Z') }],
    });

    const r = await exec(prisma);

    expect(r.linhasGeradas).toBe(0);
    expect(r.paresPuladosPorBaseZero).toBe(1);
  });

  it('Cenário 8 — sem nenhum tributo vinculado rejeita', async () => {
    const prisma = criarPrismaMock({ itens: [{ contaId: 'c', valorTotal: D('1000') }], aliquotas: [iss], rateios: [] });
    await expect(exec(prisma)).rejects.toThrow(SemBaseParaGerarImpostosError);
  });

  it('não cria segunda linha quando já existe DECLARADO manual na competência de início', async () => {
    const prisma = criarPrismaMock({
      itens: [{ contaId: 'c-3101', valorTotal: D('100000.00') }],
      aliquotas: [iss],
      rateios: [
        { id: 'manual', aliquotaParametroId: 'a-iss', contaId: 'c-3101', modoValor: 'DECLARADO', competencia: DATA_INICIO, valorDeclarado: D('999.00') },
      ],
    });

    const r = await exec(prisma);

    expect(r.linhasGeradas).toBe(0);
    expect(r.paresPuladosPorDeclarado).toBe(1);
    expect(prisma.__rateios.find((x) => x.id === 'manual')!.valorDeclarado.toFixed(2)).toBe('999.00');
  });
});
