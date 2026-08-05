import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SolicitarTermoAjusteUseCase } from './SolicitarTermoAjusteUseCase';
import { AprovarTermoAjusteN1UseCase } from './AprovarTermoAjusteN1UseCase';
import { HomologarTermoAjusteUseCase } from './HomologarTermoAjusteUseCase';
import { RejeitarTermoAjusteUseCase } from './RejeitarTermoAjusteUseCase';
import {
  ConflitoConcorrenciaError,
  TermoAjusteAcessoNegadoGestorMasterError,
  TermoAjusteAcessoNegadoN1Error,
  TermoAjusteContaNaoAnaliticaError,
  TermoAjusteEstadoInvalidoError,
  TermoAjusteMesmaContaError,
  TermoAjusteSaldoInsuficienteError,
  TermoAjusteValorInvalidoError,
} from '@/domain/plano-contas/errors';

type ContaMock = { id: string; tenantId: string; codigoErp: string; nomeConta: string; isAnalitica: boolean };
type VersaoMock = { id: string; tenantId: string; ativa: boolean };
type ValorMock = { id: string; tenantId: string; versaoId: string; contaId: string; exercicio: number; valor: Prisma.Decimal; updatedAt: Date };
type TermoMock = {
  id: string;
  tenantId: string;
  versaoId: string;
  contaOrigemId: string;
  contaDestinoId: string;
  exercicio: number;
  valor: Prisma.Decimal;
  status: string;
  createdBy: string;
  updatedAt: Date;
};

let idSeq = 1;

function criarPrismaMock(contas: ContaMock[], versoes: VersaoMock[], valoresIniciais: Partial<ValorMock>[] = [], termosIniciais: Partial<TermoMock>[] = []) {
  const contasPorId = new Map(contas.map((c) => [c.id, c]));
  const versoesPorId = new Map(versoes.map((v) => [v.id, v]));
  const valores: ValorMock[] = valoresIniciais.map((v) => ({
    id: v.id ?? `val-${idSeq++}`,
    tenantId: v.tenantId!,
    versaoId: v.versaoId!,
    contaId: v.contaId!,
    exercicio: v.exercicio!,
    valor: v.valor!,
    updatedAt: v.updatedAt ?? new Date('2026-01-01T00:00:00Z'),
  }));
  const termos: TermoMock[] = termosIniciais.map((t) => ({
    id: t.id ?? `ta-${idSeq++}`,
    tenantId: t.tenantId!,
    versaoId: t.versaoId!,
    contaOrigemId: t.contaOrigemId!,
    contaDestinoId: t.contaDestinoId!,
    exercicio: t.exercicio!,
    valor: t.valor!,
    status: t.status ?? 'PENDENTE_APROVACAO_N1',
    createdBy: t.createdBy ?? 'u1',
    updatedAt: t.updatedAt ?? new Date('2026-01-01T00:00:00Z'),
  }));

  const chaveValor = (v: Pick<ValorMock, 'tenantId' | 'versaoId' | 'contaId' | 'exercicio'>) =>
    `${v.tenantId}|${v.versaoId}|${v.contaId}|${v.exercicio}`;

  const base = {
    contaContabil: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        const conta = contasPorId.get(where.id);
        return Promise.resolve(conta && conta.tenantId === where.tenantId ? conta : null);
      }),
    },
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) => {
        const versao = versoesPorId.get(where.id as string);
        if (!versao || versao.tenantId !== where.tenantId) return Promise.resolve(null);
        if (where.ativa !== undefined && versao.ativa !== where.ativa) return Promise.resolve(null);
        return Promise.resolve(versao);
      }),
    },
    valorOrcadoConta: {
      findUnique: vi.fn(({ where }: { where: { tenantId_versaoId_contaId_exercicio: Pick<ValorMock, 'tenantId' | 'versaoId' | 'contaId' | 'exercicio'> } }) => {
        const k = chaveValor(where.tenantId_versaoId_contaId_exercicio);
        return Promise.resolve(valores.find((v) => chaveValor(v) === k) ?? null);
      }),
      create: vi.fn(({ data }: { data: Omit<ValorMock, 'id' | 'updatedAt'> }) => {
        const novo: ValorMock = { id: `val-${idSeq++}`, updatedAt: new Date(), ...data };
        valores.push(novo);
        return Promise.resolve(novo);
      }),
      updateMany: vi.fn(({ where, data }: { where: { id: string; updatedAt: Date }; data: { valor: Prisma.Decimal } }) => {
        const existente = valores.find((v) => v.id === where.id);
        if (!existente || existente.updatedAt.getTime() !== where.updatedAt.getTime()) {
          return Promise.resolve({ count: 0 });
        }
        existente.valor = data.valor;
        existente.updatedAt = new Date(existente.updatedAt.getTime() + 1);
        return Promise.resolve({ count: 1 });
      }),
    },
    termoAjuste: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        const termo = termos.find((t) => t.id === where.id);
        return Promise.resolve(termo && termo.tenantId === where.tenantId ? termo : null);
      }),
      create: vi.fn(({ data }: { data: Omit<TermoMock, 'id' | 'status' | 'updatedAt'> }) => {
        const novo: TermoMock = { id: `ta-${idSeq++}`, status: 'PENDENTE_APROVACAO_N1', updatedAt: new Date(), ...data };
        termos.push(novo);
        return Promise.resolve(novo);
      }),
      updateMany: vi.fn(({ where, data }: { where: { id: string; updatedAt: Date; status?: string }; data: { status: string } }) => {
        const existente = termos.find((t) => t.id === where.id);
        if (!existente || existente.updatedAt.getTime() !== where.updatedAt.getTime()) {
          return Promise.resolve({ count: 0 });
        }
        if (where.status !== undefined && existente.status !== where.status) {
          return Promise.resolve({ count: 0 });
        }
        existente.status = data.status;
        existente.updatedAt = new Date(existente.updatedAt.getTime() + 1);
        return Promise.resolve({ count: 1 });
      }),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const contaOrigem: ContaMock = { id: 'c1', tenantId: 't1', codigoErp: '1.1.01.001', nomeConta: 'Origem', isAnalitica: true };
const contaDestino: ContaMock = { id: 'c2', tenantId: 't1', codigoErp: '1.1.01.002', nomeConta: 'Destino', isAnalitica: true };
const contaSintetica: ContaMock = { id: 'c3', tenantId: 't1', codigoErp: '1.1.01', nomeConta: 'Sintética', isAnalitica: false };
const versao: VersaoMock = { id: 'v1', tenantId: 't1', ativa: true };

describe('SolicitarTermoAjusteUseCase [US-111, Cenário 1]', () => {
  it('cria o Termo de Ajuste como PENDENTE_APROVACAO_N1 sem alterar saldo [Cenário 1]', async () => {
    const prisma = criarPrismaMock(
      [contaOrigem, contaDestino],
      [versao],
      [{ tenantId: 't1', versaoId: 'v1', contaId: 'c1', exercicio: 2026, valor: new Prisma.Decimal(10000) }],
    );
    const useCase = new SolicitarTermoAjusteUseCase(prisma as never);

    const resultado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      versaoId: 'v1',
      contaOrigemId: 'c1',
      contaDestinoId: 'c2',
      exercicio: 2026,
      valor: '2000',
    });

    expect(resultado.status).toBe('PENDENTE_APROVACAO_N1');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'TERMO_AJUSTE_SOLICITADO' }) }),
    );
    const origem = await prisma.valorOrcadoConta.findUnique({
      where: { tenantId_versaoId_contaId_exercicio: { tenantId: 't1', versaoId: 'v1', contaId: 'c1', exercicio: 2026 } },
    });
    expect(origem?.valor.toString()).toBe('10000');
  });

  it('bloqueia saldo insuficiente na conta de origem [Cenário 2]', async () => {
    const prisma = criarPrismaMock(
      [contaOrigem, contaDestino],
      [versao],
      [{ tenantId: 't1', versaoId: 'v1', contaId: 'c1', exercicio: 2026, valor: new Prisma.Decimal(1000) }],
    );
    const useCase = new SolicitarTermoAjusteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c2', exercicio: 2026, valor: '2000' }),
    ).rejects.toThrow(TermoAjusteSaldoInsuficienteError);
    expect(prisma.termoAjuste.create).not.toHaveBeenCalled();
  });

  it('bloqueia valor <= 0', async () => {
    const prisma = criarPrismaMock([contaOrigem, contaDestino], [versao]);
    const useCase = new SolicitarTermoAjusteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c2', exercicio: 2026, valor: '0' }),
    ).rejects.toThrow(TermoAjusteValorInvalidoError);
  });

  it('bloqueia origem e destino iguais', async () => {
    const prisma = criarPrismaMock([contaOrigem], [versao]);
    const useCase = new SolicitarTermoAjusteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c1', exercicio: 2026, valor: '100' }),
    ).rejects.toThrow(TermoAjusteMesmaContaError);
  });

  it('bloqueia conta sintética na origem ou destino', async () => {
    const prisma = criarPrismaMock([contaOrigem, contaSintetica], [versao]);
    const useCase = new SolicitarTermoAjusteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c3', exercicio: 2026, valor: '100' }),
    ).rejects.toThrow(TermoAjusteContaNaoAnaliticaError);
  });
});

describe('AprovarTermoAjusteN1UseCase [US-111, Cenário 4 — 1ª etapa]', () => {
  it('aprova N1 e avança o status', async () => {
    const prisma = criarPrismaMock(
      [contaOrigem, contaDestino],
      [versao],
      [],
      [{ id: 'ta-1', tenantId: 't1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c2', exercicio: 2026, valor: new Prisma.Decimal(2000), status: 'PENDENTE_APROVACAO_N1' }],
    );
    const useCase = new AprovarTermoAjusteN1UseCase(prisma as never);

    const resultado = await useCase.execute({ tenantId: 't1', usuarioId: 'u2', termoAjusteId: 'ta-1', temPermissaoAprovarN1: true });

    expect(resultado.status).toBe('PENDENTE_APROVACAO_GESTOR_MASTER');
  });

  it('bloqueia sem permissão [Cenário 6]', async () => {
    const prisma = criarPrismaMock(
      [],
      [],
      [],
      [{ tenantId: 't1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c2', exercicio: 2026, valor: new Prisma.Decimal(2000) }],
    );
    const useCase = new AprovarTermoAjusteN1UseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u2', termoAjusteId: 'ta-1', temPermissaoAprovarN1: false }),
    ).rejects.toThrow(TermoAjusteAcessoNegadoN1Error);
  });

  it('bloqueia transição fora de ordem (já homologado)', async () => {
    const prisma = criarPrismaMock(
      [],
      [],
      [],
      [{ id: 'ta-1', tenantId: 't1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c2', exercicio: 2026, valor: new Prisma.Decimal(2000), status: 'HOMOLOGADO' }],
    );
    const useCase = new AprovarTermoAjusteN1UseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u2', termoAjusteId: 'ta-1', temPermissaoAprovarN1: true }),
    ).rejects.toThrow(TermoAjusteEstadoInvalidoError);
  });
});

describe('HomologarTermoAjusteUseCase [US-111, Cenário 4 — 2ª etapa / Cenário 5]', () => {
  it('debita origem, credita destino (nova linha) e homologa', async () => {
    const prisma = criarPrismaMock(
      [contaOrigem, contaDestino],
      [versao],
      [{ id: 'val-origem', tenantId: 't1', versaoId: 'v1', contaId: 'c1', exercicio: 2026, valor: new Prisma.Decimal(10000) }],
      [{ id: 'ta-1', tenantId: 't1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c2', exercicio: 2026, valor: new Prisma.Decimal(2000), status: 'PENDENTE_APROVACAO_GESTOR_MASTER' }],
    );
    const useCase = new HomologarTermoAjusteUseCase(prisma as never);

    const resultado = await useCase.execute({ tenantId: 't1', usuarioId: 'u3', termoAjusteId: 'ta-1', temPermissaoGestorMaster: true });

    expect(resultado.status).toBe('HOMOLOGADO');
    const origem = await prisma.valorOrcadoConta.findUnique({
      where: { tenantId_versaoId_contaId_exercicio: { tenantId: 't1', versaoId: 'v1', contaId: 'c1', exercicio: 2026 } },
    });
    const destino = await prisma.valorOrcadoConta.findUnique({
      where: { tenantId_versaoId_contaId_exercicio: { tenantId: 't1', versaoId: 'v1', contaId: 'c2', exercicio: 2026 } },
    });
    expect(origem?.valor.toString()).toBe('8000');
    expect(destino?.valor.toString()).toBe('2000');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'TERMO_AJUSTE_HOMOLOGADO' }) }),
    );
  });

  it('credita em linha existente da conta destino, preservando invariância', async () => {
    const prisma = criarPrismaMock(
      [contaOrigem, contaDestino],
      [versao],
      [
        { id: 'val-origem', tenantId: 't1', versaoId: 'v1', contaId: 'c1', exercicio: 2026, valor: new Prisma.Decimal(10000) },
        { id: 'val-destino', tenantId: 't1', versaoId: 'v1', contaId: 'c2', exercicio: 2026, valor: new Prisma.Decimal(5000) },
      ],
      [{ id: 'ta-1', tenantId: 't1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c2', exercicio: 2026, valor: new Prisma.Decimal(2000), status: 'PENDENTE_APROVACAO_GESTOR_MASTER' }],
    );
    const useCase = new HomologarTermoAjusteUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u3', termoAjusteId: 'ta-1', temPermissaoGestorMaster: true });

    const origem = await prisma.valorOrcadoConta.findUnique({
      where: { tenantId_versaoId_contaId_exercicio: { tenantId: 't1', versaoId: 'v1', contaId: 'c1', exercicio: 2026 } },
    });
    const destino = await prisma.valorOrcadoConta.findUnique({
      where: { tenantId_versaoId_contaId_exercicio: { tenantId: 't1', versaoId: 'v1', contaId: 'c2', exercicio: 2026 } },
    });
    expect(origem?.valor.toString()).toBe('8000');
    expect(destino?.valor.toString()).toBe('7000');
  });

  it('bloqueia sem permissão de Gestor Master [Cenário 6]', async () => {
    const prisma = criarPrismaMock(
      [contaOrigem, contaDestino],
      [versao],
      [{ tenantId: 't1', versaoId: 'v1', contaId: 'c1', exercicio: 2026, valor: new Prisma.Decimal(10000) }],
      [{ id: 'ta-1', tenantId: 't1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c2', exercicio: 2026, valor: new Prisma.Decimal(2000), status: 'PENDENTE_APROVACAO_GESTOR_MASTER' }],
    );
    const useCase = new HomologarTermoAjusteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u3', termoAjusteId: 'ta-1', temPermissaoGestorMaster: false }),
    ).rejects.toThrow(TermoAjusteAcessoNegadoGestorMasterError);
  });

  it('bloqueia homologação fora de ordem (ainda em N1)', async () => {
    const prisma = criarPrismaMock(
      [contaOrigem, contaDestino],
      [versao],
      [{ tenantId: 't1', versaoId: 'v1', contaId: 'c1', exercicio: 2026, valor: new Prisma.Decimal(10000) }],
      [{ id: 'ta-1', tenantId: 't1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c2', exercicio: 2026, valor: new Prisma.Decimal(2000), status: 'PENDENTE_APROVACAO_N1' }],
    );
    const useCase = new HomologarTermoAjusteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u3', termoAjusteId: 'ta-1', temPermissaoGestorMaster: true }),
    ).rejects.toThrow(TermoAjusteEstadoInvalidoError);
  });

  it('bloqueia conflito de concorrência quando o token diverge [Cenário 5, US-105]', async () => {
    const tokenAntigo = new Date('2020-01-01T00:00:00Z');
    const prisma = criarPrismaMock(
      [contaOrigem, contaDestino],
      [versao],
      [{ tenantId: 't1', versaoId: 'v1', contaId: 'c1', exercicio: 2026, valor: new Prisma.Decimal(10000) }],
      [{ id: 'ta-1', tenantId: 't1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c2', exercicio: 2026, valor: new Prisma.Decimal(2000), status: 'PENDENTE_APROVACAO_GESTOR_MASTER' }],
    );
    const useCase = new HomologarTermoAjusteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u3', termoAjusteId: 'ta-1', temPermissaoGestorMaster: true, tokenConcorrencia: tokenAntigo }),
    ).rejects.toThrow(ConflitoConcorrenciaError);
  });
});

describe('RejeitarTermoAjusteUseCase [US-111]', () => {
  it('rejeita a partir de PENDENTE_APROVACAO_N1 com permissão de N1', async () => {
    const prisma = criarPrismaMock(
      [],
      [],
      [],
      [{ id: 'ta-1', tenantId: 't1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c2', exercicio: 2026, valor: new Prisma.Decimal(2000), status: 'PENDENTE_APROVACAO_N1' }],
    );
    const useCase = new RejeitarTermoAjusteUseCase(prisma as never);

    const resultado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u2',
      termoAjusteId: 'ta-1',
      temPermissaoAprovarN1: true,
      temPermissaoGestorMaster: false,
    });

    expect(resultado.status).toBe('REJEITADO');
  });

  it('bloqueia rejeição de termo já homologado', async () => {
    const prisma = criarPrismaMock(
      [],
      [],
      [],
      [{ id: 'ta-1', tenantId: 't1', versaoId: 'v1', contaOrigemId: 'c1', contaDestinoId: 'c2', exercicio: 2026, valor: new Prisma.Decimal(2000), status: 'HOMOLOGADO' }],
    );
    const useCase = new RejeitarTermoAjusteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u2', termoAjusteId: 'ta-1', temPermissaoAprovarN1: true, temPermissaoGestorMaster: true }),
    ).rejects.toThrow(TermoAjusteEstadoInvalidoError);
  });
});
