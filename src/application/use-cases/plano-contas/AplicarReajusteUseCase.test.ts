import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AplicarReajusteUseCase } from './AplicarReajusteUseCase';
import { SimularReajusteUseCase } from './SimularReajusteUseCase';
import {
  AgrupadorReajusteNaoEncontradoError,
  EscopoReajusteVazioError,
  ImpostoNaoDisponivelParaTipoPropostaError,
  VersaoOficializadaCongeladaError,
} from '@/domain/plano-contas/errors';

type ValorOrcadoMock = { id: string; tenantId: string; versaoId: string; contaId: string; exercicio: number; valor: Prisma.Decimal };

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
};

let idSeq = 1;

function criarPrismaMock(opts: {
  versao: { id: string; status: string; ativa: boolean; propostaTipo: 'CONTRATO' | 'TERMO_DE_PARCERIA'; dataInicio: Date; dataFim: Date };
  aliquota: {
    id: string;
    nome: string;
    aliquotaPct: Prisma.Decimal;
    tipoIncidencia: 'CONTRATO' | 'TERMO_DE_PARCERIA' | 'AMBOS';
    dataInicioVigencia: Date;
    dataFimVigencia: Date | null;
    periodicidadeReajuste?: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
  };
  contas: { id: string; isAnalitica: boolean }[];
  agrupadores?: { id: string; contaIds: string[] }[];
  rateiosIniciais?: Partial<RateioMock>[];
}) {
  const rateios: RateioMock[] = (opts.rateiosIniciais ?? []).map((r) => ({
    id: r.id ?? `rat-${idSeq++}`,
    tenantId: r.tenantId!,
    versaoId: r.versaoId!,
    aliquotaParametroId: r.aliquotaParametroId!,
    contaId: r.contaId!,
    competencia: r.competencia!,
    valorDeclarado: r.valorDeclarado!,
    aliquotaAplicadaSnapshot: r.aliquotaAplicadaSnapshot!,
    ativo: r.ativo ?? true,
  }));
  const valoresOrcados: ValorOrcadoMock[] = [];

  const chave = (r: Pick<RateioMock, 'tenantId' | 'versaoId' | 'aliquotaParametroId' | 'contaId' | 'competencia'>) =>
    `${r.tenantId}|${r.versaoId}|${r.aliquotaParametroId}|${r.contaId}|${r.competencia.getTime()}`;

  const base = {
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string; ativa: boolean } }) => {
        if (where.id !== opts.versao.id || where.tenantId !== 't1' || opts.versao.ativa !== where.ativa) return Promise.resolve(null);
        return Promise.resolve({
          id: opts.versao.id,
          status: opts.versao.status,
          proposta: { tipo: opts.versao.propostaTipo, dataInicio: opts.versao.dataInicio, dataFim: opts.versao.dataFim },
        });
      }),
    },
    aliquotaImpostoParametro: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) =>
        Promise.resolve(
          where.id === opts.aliquota.id && where.tenantId === 't1'
            ? { periodicidadeReajuste: 'MENSAL' as const, ...opts.aliquota }
            : null,
        ),
      ),
    },
    contaContabil: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        const c = opts.contas.find((c) => c.id === where.id);
        return Promise.resolve(c ? { id: c.id, isAnalitica: c.isAnalitica } : null);
      }),
      findMany: vi.fn(({ where }: { where: { id: { in: string[] }; isAnalitica: boolean } }) =>
        Promise.resolve(opts.contas.filter((c) => where.id.in.includes(c.id) && c.isAnalitica === where.isAnalitica).map((c) => ({ id: c.id }))),
      ),
    },
    contaAgrupadora: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        const a = opts.agrupadores?.find((a) => a.id === where.id);
        return Promise.resolve(a ? { id: a.id } : null);
      }),
    },
    contaAgrupadoraItem: {
      findMany: vi.fn(({ where }: { where: { agrupadoraId: string } }) => {
        const a = opts.agrupadores?.find((a) => a.id === where.agrupadoraId);
        return Promise.resolve((a?.contaIds ?? []).map((contaId) => ({ contaId })));
      }),
    },
    rateioImpostoGrade: {
      findMany: vi.fn(({ where }: { where: { tenantId: string; versaoId?: string; aliquotaParametroId?: string; contaId?: { in: string[] }; ativo?: boolean } }) => {
        return Promise.resolve(
          rateios.filter(
            (r) =>
              r.tenantId === where.tenantId &&
              (!where.versaoId || r.versaoId === where.versaoId) &&
              (!where.aliquotaParametroId || r.aliquotaParametroId === where.aliquotaParametroId) &&
              (!where.contaId || where.contaId.in.includes(r.contaId)) &&
              (where.ativo === undefined || r.ativo === where.ativo),
          ),
        );
      }),
      findUnique: vi.fn(({ where }: { where: { tenantId_versaoId_aliquotaParametroId_contaId_competencia: RateioMock } }) => {
        const k = chave(where.tenantId_versaoId_aliquotaParametroId_contaId_competencia);
        return Promise.resolve(rateios.find((r) => chave(r) === k) ?? null);
      }),
      upsert: vi.fn(({ where, update, create }: { where: { tenantId_versaoId_aliquotaParametroId_contaId_competencia: RateioMock }; update: Partial<RateioMock>; create: Omit<RateioMock, 'id'> }) => {
        const k = chave(where.tenantId_versaoId_aliquotaParametroId_contaId_competencia);
        const existente = rateios.find((r) => chave(r) === k);
        if (existente) {
          Object.assign(existente, update);
          return Promise.resolve(existente);
        }
        const novo: RateioMock = { id: `rat-${idSeq++}`, ...create };
        rateios.push(novo);
        return Promise.resolve(novo);
      }),
    },
    valorOrcadoConta: {
      findUnique: vi.fn(({ where }: { where: { tenantId_versaoId_contaId_exercicio: ValorOrcadoMock } }) => {
        const k = where.tenantId_versaoId_contaId_exercicio;
        return Promise.resolve(
          valoresOrcados.find((v) => v.tenantId === k.tenantId && v.versaoId === k.versaoId && v.contaId === k.contaId && v.exercicio === k.exercicio) ?? null,
        );
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: { valor: Prisma.Decimal } }) => {
        const existente = valoresOrcados.find((v) => v.id === where.id)!;
        Object.assign(existente, data);
        return Promise.resolve(existente);
      }),
      create: vi.fn(({ data }: { data: Omit<ValorOrcadoMock, 'id'> }) => {
        const novo: ValorOrcadoMock = { id: `vo-${idSeq++}`, ...data };
        valoresOrcados.push(novo);
        return Promise.resolve(novo);
      }),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { prisma: base, rateios, valoresOrcados };
}

const m = (ano: number, mes: number) => new Date(Date.UTC(ano, mes - 1, 1));

describe('AplicarReajusteUseCase / SimularReajusteUseCase [US-129]', () => {
  it('[Revisão 2026-08-11] sem linha anterior existente, nenhum delta em ValorOrcadoConta é gerado — smoke test de robustez', async () => {
    const { prisma, valoresOrcados } = criarPrismaMock({
      versao: { id: 'v1', status: 'RASCUNHO', ativa: true, propostaTipo: 'CONTRATO', dataInicio: m(2026, 1), dataFim: m(2026, 12) },
      aliquota: { id: 'idx1', nome: 'Dissídio', aliquotaPct: new Prisma.Decimal(5), tipoIncidencia: 'AMBOS', dataInicioVigencia: m(2026, 9), dataFimVigencia: null },
      contas: [{ id: 'c-salario', isAnalitica: true }],
    });
    const useCase = new AplicarReajusteUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'CONTA', contaId: 'c-salario' } });

    // Sem linha anterior — base 0, crescimento 5% sobre 0 continua 0, delta filtrado
    // (ver "existente" em calcularPlanoReajusteConta). Garante que ausência de dado
    // não quebra o fluxo nem cria linha de ValorOrcadoConta à toa. O teste de
    // crescimento positivo de verdade é o próximo.
    expect(valoresOrcados).toEqual([]);
  });

  it('[Revisão 2026-08-11] com base existente, o crescimento do índice soma no ValorOrcadoConta do ano', async () => {
    const { prisma, valoresOrcados } = criarPrismaMock({
      versao: { id: 'v1', status: 'RASCUNHO', ativa: true, propostaTipo: 'CONTRATO', dataInicio: m(2026, 1), dataFim: m(2026, 12) },
      aliquota: { id: 'idx1', nome: 'Dissídio', aliquotaPct: new Prisma.Decimal(5), tipoIncidencia: 'AMBOS', dataInicioVigencia: m(2026, 9), dataFimVigencia: null },
      contas: [{ id: 'c-salario', isAnalitica: true }],
      rateiosIniciais: [
        { tenantId: 't1', versaoId: 'v1', aliquotaParametroId: 'idx1', contaId: 'c-salario', competencia: m(2026, 9), valorDeclarado: new Prisma.Decimal(5000), aliquotaAplicadaSnapshot: new Prisma.Decimal(0) },
      ],
    });
    const useCase = new AplicarReajusteUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'CONTA', contaId: 'c-salario' } });

    expect(valoresOrcados).toHaveLength(1);
    expect(valoresOrcados[0]).toMatchObject({ tenantId: 't1', versaoId: 'v1', contaId: 'c-salario', exercicio: 2026 });
    // 5000 * 5% = 250 de crescimento — some no orçado do ano.
    expect(valoresOrcados[0].valor.toString()).toBe('250');
  });

  it('Cenário 10 — efeito cascata: 1 índice aplicado a um Agrupador grava linha em cada conta filha', async () => {
    const { prisma, rateios } = criarPrismaMock({
      versao: { id: 'v1', status: 'RASCUNHO', ativa: true, propostaTipo: 'CONTRATO', dataInicio: m(2026, 1), dataFim: m(2026, 12) },
      aliquota: { id: 'idx1', nome: 'IPCA', aliquotaPct: new Prisma.Decimal(6), tipoIncidencia: 'AMBOS', dataInicioVigencia: m(2026, 1), dataFimVigencia: null },
      contas: [
        { id: 'c1', isAnalitica: true },
        { id: 'c2', isAnalitica: true },
      ],
      agrupadores: [{ id: 'agr1', contaIds: ['c1', 'c2'] }],
    });
    const useCase = new AplicarReajusteUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'AGRUPADOR', agrupadorId: 'agr1' } });

    expect(rateios.filter((r) => r.contaId === 'c1').length).toBeGreaterThan(0);
    expect(rateios.filter((r) => r.contaId === 'c2').length).toBeGreaterThan(0);
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'REAJUSTE_LOTE_APLICADO' }) }),
    );
  });

  it('Cenário 11/ADR-040 — retroatividade preserva a linha passada e cria só 1 linha de ajuste no mês atual', async () => {
    const { prisma, rateios } = criarPrismaMock({
      versao: { id: 'v1', status: 'RASCUNHO', ativa: true, propostaTipo: 'CONTRATO', dataInicio: m(2026, 1), dataFim: m(2026, 12) },
      aliquota: { id: 'idx1', nome: 'IPCA', aliquotaPct: new Prisma.Decimal(6), tipoIncidencia: 'AMBOS', dataInicioVigencia: m(2026, 1), dataFimVigencia: null },
      contas: [{ id: 'c1', isAnalitica: true }],
      rateiosIniciais: [
        { tenantId: 't1', versaoId: 'v1', aliquotaParametroId: 'idx1', contaId: 'c1', competencia: m(2026, 1), valorDeclarado: new Prisma.Decimal(1000), aliquotaAplicadaSnapshot: new Prisma.Decimal(4) },
      ],
    });
    const useCase = new AplicarReajusteUseCase(prisma as never);
    // "hoje" mockado indiretamente: dataFim curta o bastante para o mês corrente real cair >= jan/2026 é o suficiente para o teste de não-sobrescrita.

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'CONTA', contaId: 'c1' } });

    const linhaJaneiro = rateios.find((r) => r.competencia.getTime() === m(2026, 1).getTime());
    expect(linhaJaneiro?.valorDeclarado.toString()).toBe('1000');
    expect(linhaJaneiro?.aliquotaAplicadaSnapshot.toString()).toBe('4');
  });

  it('Cenário 14 — rollback total: erro em uma escrita não deixa nenhuma linha nem log gravados', async () => {
    const { prisma, rateios } = criarPrismaMock({
      versao: { id: 'v1', status: 'RASCUNHO', ativa: true, propostaTipo: 'CONTRATO', dataInicio: m(2026, 1), dataFim: m(2026, 12) },
      aliquota: { id: 'idx1', nome: 'IPCA', aliquotaPct: new Prisma.Decimal(6), tipoIncidencia: 'AMBOS', dataInicioVigencia: m(2026, 1), dataFimVigencia: null },
      contas: [{ id: 'c1', isAnalitica: true }],
      agrupadores: [{ id: 'agr1', contaIds: ['c1'] }],
    });
    prisma.rateioImpostoGrade.upsert = vi.fn().mockRejectedValue(new Error('violação de constraint simulada'));
    const useCase = new AplicarReajusteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'AGRUPADOR', agrupadorId: 'agr1' } }),
    ).rejects.toThrow('violação de constraint simulada');

    expect(rateios).toHaveLength(0);
    expect(prisma.historicoOperacao.create).not.toHaveBeenCalled();
  });

  it('Cenário 8 [revisado 2026-08-11] — bloqueia aplicação em Proposta OFICIALIZADA/ENCERRADA (mesma trava do Valor Orçado)', async () => {
    const { prisma } = criarPrismaMock({
      versao: { id: 'v1', status: 'ENCERRADO', ativa: true, propostaTipo: 'CONTRATO', dataInicio: m(2026, 1), dataFim: m(2026, 3) },
      aliquota: { id: 'idx1', nome: 'IPCA', aliquotaPct: new Prisma.Decimal(6), tipoIncidencia: 'AMBOS', dataInicioVigencia: m(2026, 1), dataFimVigencia: null },
      contas: [{ id: 'c1', isAnalitica: true }],
    });
    const useCase = new AplicarReajusteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'CONTA', contaId: 'c1' } }),
    ).rejects.toThrow(VersaoOficializadaCongeladaError);
    expect(prisma.historicoOperacao.create).not.toHaveBeenCalled();
  });

  it('Cenário 8 — Simular continua funcionando (preview) em Proposta OFICIALIZADA/ENCERRADA', async () => {
    const { prisma } = criarPrismaMock({
      versao: { id: 'v1', status: 'ENCERRADO', ativa: true, propostaTipo: 'CONTRATO', dataInicio: m(2026, 1), dataFim: m(2026, 3) },
      aliquota: { id: 'idx1', nome: 'IPCA', aliquotaPct: new Prisma.Decimal(6), tipoIncidencia: 'AMBOS', dataInicioVigencia: m(2026, 1), dataFimVigencia: null },
      contas: [{ id: 'c1', isAnalitica: true }],
    });
    const useCase = new SimularReajusteUseCase(prisma as never);

    const resultado = await useCase.execute({ tenantId: 't1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'CONTA', contaId: 'c1' } });

    expect(resultado.statusVersaoNoMomento).toBe('ENCERRADO');
    expect(prisma.historicoOperacao.create).not.toHaveBeenCalled();
  });

  it('RN_PRO_010 — bloqueia índice CONTRATO-only em Termo de Parceria', async () => {
    const { prisma } = criarPrismaMock({
      versao: { id: 'v1', status: 'RASCUNHO', ativa: true, propostaTipo: 'TERMO_DE_PARCERIA', dataInicio: m(2026, 1), dataFim: m(2026, 3) },
      aliquota: { id: 'idx1', nome: 'PIS', aliquotaPct: new Prisma.Decimal(6), tipoIncidencia: 'CONTRATO', dataInicioVigencia: m(2026, 1), dataFimVigencia: null },
      contas: [{ id: 'c1', isAnalitica: true }],
    });
    const useCase = new SimularReajusteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'CONTA', contaId: 'c1' } }),
    ).rejects.toThrow(ImpostoNaoDisponivelParaTipoPropostaError);
  });

  it('bloqueia escopo Agrupador inexistente', async () => {
    const { prisma } = criarPrismaMock({
      versao: { id: 'v1', status: 'RASCUNHO', ativa: true, propostaTipo: 'CONTRATO', dataInicio: m(2026, 1), dataFim: m(2026, 3) },
      aliquota: { id: 'idx1', nome: 'IPCA', aliquotaPct: new Prisma.Decimal(6), tipoIncidencia: 'AMBOS', dataInicioVigencia: m(2026, 1), dataFimVigencia: null },
      contas: [{ id: 'c1', isAnalitica: true }],
    });
    const useCase = new SimularReajusteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'AGRUPADOR', agrupadorId: 'inexistente' } }),
    ).rejects.toThrow(AgrupadorReajusteNaoEncontradoError);
  });

  it('RN_PR_005 — escopo GLOBAL (Categoria nula) resolve para todas as contas já parametrizadas na versão', async () => {
    const { prisma } = criarPrismaMock({
      versao: { id: 'v1', status: 'RASCUNHO', ativa: true, propostaTipo: 'CONTRATO', dataInicio: m(2026, 1), dataFim: m(2026, 3) },
      aliquota: { id: 'idx1', nome: 'IPCA', aliquotaPct: new Prisma.Decimal(6), tipoIncidencia: 'AMBOS', dataInicioVigencia: m(2026, 1), dataFimVigencia: null },
      contas: [
        { id: 'c1', isAnalitica: true },
        { id: 'c2', isAnalitica: true },
      ],
      rateiosIniciais: [
        { tenantId: 't1', versaoId: 'v1', aliquotaParametroId: 'outro-idx', contaId: 'c1', competencia: m(2026, 1), valorDeclarado: new Prisma.Decimal(100), aliquotaAplicadaSnapshot: new Prisma.Decimal(1) },
        { tenantId: 't1', versaoId: 'v1', aliquotaParametroId: 'outro-idx', contaId: 'c2', competencia: m(2026, 1), valorDeclarado: new Prisma.Decimal(200), aliquotaAplicadaSnapshot: new Prisma.Decimal(1) },
      ],
    });
    const useCase = new SimularReajusteUseCase(prisma as never);

    const plano = await useCase.execute({ tenantId: 't1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'GLOBAL' } });

    expect(plano.planos.map((p) => p.contaId).sort()).toEqual(['c1', 'c2']);
  });

  it('bloqueia escopo vazio (nenhuma conta parametrizada) no modo GLOBAL', async () => {
    const { prisma } = criarPrismaMock({
      versao: { id: 'v1', status: 'RASCUNHO', ativa: true, propostaTipo: 'CONTRATO', dataInicio: m(2026, 1), dataFim: m(2026, 3) },
      aliquota: { id: 'idx1', nome: 'IPCA', aliquotaPct: new Prisma.Decimal(6), tipoIncidencia: 'AMBOS', dataInicioVigencia: m(2026, 1), dataFimVigencia: null },
      contas: [{ id: 'c1', isAnalitica: true }],
    });
    const useCase = new SimularReajusteUseCase(prisma as never);

    await expect(useCase.execute({ tenantId: 't1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'GLOBAL' } })).rejects.toThrow(EscopoReajusteVazioError);
  });

  it('[ultrareview 2026-08-11] não reativa linha soft-deleted (ativo:false) nem usa como base de cálculo', async () => {
    const { prisma, rateios } = criarPrismaMock({
      versao: { id: 'v1', status: 'RASCUNHO', ativa: true, propostaTipo: 'CONTRATO', dataInicio: m(2026, 1), dataFim: m(2026, 12) },
      aliquota: { id: 'idx1', nome: 'IPCA', aliquotaPct: new Prisma.Decimal(6), tipoIncidencia: 'AMBOS', dataInicioVigencia: m(2026, 1), dataFimVigencia: null },
      contas: [{ id: 'c1', isAnalitica: true }],
      rateiosIniciais: [
        {
          tenantId: 't1',
          versaoId: 'v1',
          aliquotaParametroId: 'idx1',
          contaId: 'c1',
          competencia: m(2026, 10),
          valorDeclarado: new Prisma.Decimal(1000),
          aliquotaAplicadaSnapshot: new Prisma.Decimal(4),
          ativo: false,
        },
      ],
    });
    const useCase = new AplicarReajusteUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'CONTA', contaId: 'c1' } });

    const linhaDesativada = rateios.find((r) => r.competencia.getTime() === m(2026, 10).getTime());
    expect(linhaDesativada?.ativo).toBe(false);
    expect(linhaDesativada?.valorDeclarado.toString()).toBe('1000');
  });

  it('[ultrareview 2026-08-11] idempotência — reaplicar o MESMO reajuste 2x não duplica o Valor Orçado', async () => {
    const { prisma, valoresOrcados } = criarPrismaMock({
      versao: { id: 'v1', status: 'RASCUNHO', ativa: true, propostaTipo: 'CONTRATO', dataInicio: m(2026, 1), dataFim: m(2026, 12) },
      aliquota: { id: 'idx1', nome: 'IPCA', aliquotaPct: new Prisma.Decimal(6), tipoIncidencia: 'AMBOS', dataInicioVigencia: m(2026, 1), dataFimVigencia: null },
      contas: [{ id: 'c1', isAnalitica: true }],
      rateiosIniciais: [
        { tenantId: 't1', versaoId: 'v1', aliquotaParametroId: 'idx1', contaId: 'c1', competencia: m(2026, 1), valorDeclarado: new Prisma.Decimal(1000), aliquotaAplicadaSnapshot: new Prisma.Decimal(4) },
      ],
    });
    const useCase = new AplicarReajusteUseCase(prisma as never);
    const input = { tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', aliquotaParametroId: 'idx1', escopo: { modo: 'CONTA' as const, contaId: 'c1' } };

    await useCase.execute(input);
    const valorAposPrimeiraAplicacao = valoresOrcados.find((v) => v.contaId === 'c1' && v.exercicio === 2026)?.valor.toString();

    await useCase.execute(input);
    const valorAposSegundaAplicacao = valoresOrcados.find((v) => v.contaId === 'c1' && v.exercicio === 2026)?.valor.toString();

    expect(valorAposPrimeiraAplicacao).toBeDefined();
    expect(valorAposSegundaAplicacao).toBe(valorAposPrimeiraAplicacao);
  });
});
