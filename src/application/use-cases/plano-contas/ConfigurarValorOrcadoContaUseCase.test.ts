import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ConfigurarValorOrcadoContaUseCase } from './ConfigurarValorOrcadoContaUseCase';
import {
  ConflitoConcorrenciaError,
  ValorOrcadoContaSinteticaError,
  ValorOrcadoInvalidoError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';

type ContaMock = { id: string; tenantId: string; codigoErp: string; nomeConta: string; idPai: string | null; isAnalitica: boolean };
type VersaoMock = { id: string; tenantId: string; propostaId: string; status: string; ativa: boolean; vigente: boolean; numeroVersao: number };
type ValorMock = {
  id: string;
  tenantId: string;
  versaoId: string;
  contaId: string;
  exercicio: number;
  valor: Prisma.Decimal;
  updatedAt: Date;
};

let idSeq = 1;

function criarPrismaMock(contas: ContaMock[], versoes: VersaoMock[], valoresIniciais: Partial<ValorMock>[] = []) {
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

  const chave = (v: Pick<ValorMock, 'tenantId' | 'versaoId' | 'contaId' | 'exercicio'>) =>
    `${v.tenantId}|${v.versaoId}|${v.contaId}|${v.exercicio}`;

  const base = {
    contaContabil: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        const conta = contasPorId.get(where.id);
        return Promise.resolve(conta && conta.tenantId === where.tenantId ? conta : null);
      }),
      findMany: vi.fn(() => Promise.resolve(contas.map((c) => ({ id: c.id, idPai: c.idPai, isAnalitica: c.isAnalitica })))),
    },
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) => {
        const versao = versoesPorId.get(where.id as string);
        if (!versao || versao.tenantId !== where.tenantId) return Promise.resolve(null);
        if (where.ativa !== undefined && versao.ativa !== where.ativa) return Promise.resolve(null);
        if (where.vigente !== undefined && versao.vigente !== where.vigente) return Promise.resolve(null);
        return Promise.resolve(versao);
      }),
    },
    valorOrcadoConta: {
      findUnique: vi.fn(({ where }: { where: { tenantId_versaoId_contaId_exercicio: Pick<ValorMock, 'tenantId' | 'versaoId' | 'contaId' | 'exercicio'> } }) => {
        const k = chave(where.tenantId_versaoId_contaId_exercicio);
        return Promise.resolve(valores.find((v) => chave(v) === k) ?? null);
      }),
      findMany: vi.fn(({ where }: { where: { tenantId: string; versaoId: string; exercicio: number } }) =>
        Promise.resolve(valores.filter((v) => v.tenantId === where.tenantId && v.versaoId === where.versaoId && v.exercicio === where.exercicio)),
      ),
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
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const contaAnalitica: ContaMock = { id: 'c7', tenantId: 't1', codigoErp: '1.9.11.001', nomeConta: 'Passagens Aéreas Nacionais', idPai: 'c6', isAnalitica: true };
const contaN6: ContaMock = { id: 'c6', tenantId: 't1', codigoErp: '1.9.11', nomeConta: 'Viagens', idPai: 'c5', isAnalitica: false };
const contaN5: ContaMock = { id: 'c5', tenantId: 't1', codigoErp: '1.9', nomeConta: 'Despesas Gerais', idPai: null, isAnalitica: false };

const versaoRascunho: VersaoMock = { id: 'v1', tenantId: 't1', propostaId: 'p1', status: 'RASCUNHO', ativa: true, vigente: true, numeroVersao: 1 };
const versaoOficializada: VersaoMock = { ...versaoRascunho, id: 'v2', status: 'OFICIALIZADO' };

describe('ConfigurarValorOrcadoContaUseCase [US-007]', () => {
  it('persiste valor em conta analítica e recalcula totais ancestrais [Cenário 1]', async () => {
    const prisma = criarPrismaMock([contaAnalitica, contaN6, contaN5], [versaoRascunho]);
    const useCase = new ConfigurarValorOrcadoContaUseCase(prisma as never);

    const resultado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      versaoId: 'v1',
      contaId: 'c7',
      exercicio: 2026,
      valor: '50000.00',
    });

    expect(resultado.valor.toString()).toBe('50000');
    expect(resultado.totaisAncestrais).toEqual([
      { contaId: 'c6', total: expect.objectContaining({}) },
      { contaId: 'c5', total: expect.objectContaining({}) },
    ]);
    expect(resultado.totaisAncestrais[0].total.toString()).toBe('50000');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipoOperacao: 'VALOR_ORCADO_CONFIGURADO' }),
      }),
    );
  });

  it('recalcula corretamente ao alterar valor existente [Cenário 2]', async () => {
    const prisma = criarPrismaMock(
      [contaAnalitica, contaN6, contaN5],
      [versaoRascunho],
      [{ tenantId: 't1', versaoId: 'v1', contaId: 'c7', exercicio: 2026, valor: new Prisma.Decimal(50000) }],
    );
    const useCase = new ConfigurarValorOrcadoContaUseCase(prisma as never);

    const resultado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      versaoId: 'v1',
      contaId: 'c7',
      exercicio: 2026,
      valor: '80000.00',
    });

    expect(resultado.totaisAncestrais[0].total.toString()).toBe('80000');
  });

  it('bloqueia valor em conta sintética [Cenário 3]', async () => {
    const prisma = criarPrismaMock([contaAnalitica, contaN6, contaN5], [versaoRascunho]);
    const useCase = new ConfigurarValorOrcadoContaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', contaId: 'c6', exercicio: 2026, valor: '100' }),
    ).rejects.toThrow(ValorOrcadoContaSinteticaError);
  });

  it('bloqueia valor negativo [Cenário 4]', async () => {
    const prisma = criarPrismaMock([contaAnalitica, contaN6, contaN5], [versaoRascunho]);
    const useCase = new ConfigurarValorOrcadoContaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', contaId: 'c7', exercicio: 2026, valor: '-1' }),
    ).rejects.toThrow(ValorOrcadoInvalidoError);
  });

  it('isola valores por exercício diferente na mesma versão [Cenário 5/7]', async () => {
    const prisma = criarPrismaMock(
      [contaAnalitica, contaN6, contaN5],
      [versaoRascunho],
      [{ tenantId: 't1', versaoId: 'v1', contaId: 'c7', exercicio: 2025, valor: new Prisma.Decimal(45000) }],
    );
    const useCase = new ConfigurarValorOrcadoContaUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', contaId: 'c7', exercicio: 2026, valor: '50000' });

    const registro2025 = await prisma.valorOrcadoConta.findUnique({
      where: {
        tenantId_versaoId_contaId_exercicio: {
          tenantId: 't1',
          versaoId: 'v1',
          contaId: 'c7',
          exercicio: 2025,
        },
      },
    });
    expect(registro2025?.valor.toString()).toBe('45000');
  });

  it('bloqueia edição em versão Oficializada [Trava o Erro]', async () => {
    const prisma = criarPrismaMock([contaAnalitica, contaN6, contaN5], [versaoOficializada]);
    const useCase = new ConfigurarValorOrcadoContaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v2', contaId: 'c7', exercicio: 2026, valor: '100' }),
    ).rejects.toThrow(VersaoPropostaInvalidaError);
  });

  it('bloqueia conflito de concorrência quando o token informado diverge do estado atual [Cenário 2, US-105]', async () => {
    const tokenAntigo = new Date('2026-01-01T00:00:00Z');
    const prisma = criarPrismaMock(
      [contaAnalitica, contaN6, contaN5],
      [versaoRascunho],
      [{ tenantId: 't1', versaoId: 'v1', contaId: 'c7', exercicio: 2026, valor: new Prisma.Decimal(1000), updatedAt: new Date('2026-01-02T00:00:00Z') }],
    );
    const useCase = new ConfigurarValorOrcadoContaUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        versaoId: 'v1',
        contaId: 'c7',
        exercicio: 2026,
        valor: '2000',
        tokenConcorrencia: tokenAntigo,
      }),
    ).rejects.toThrow(ConflitoConcorrenciaError);
    expect(prisma.historicoOperacao.create).not.toHaveBeenCalled();
  });

  it('bloqueia conflito detectado só no updateMany (corrida real entre leitura e escrita) [US-105]', async () => {
    const updatedAtLido = new Date('2026-01-01T00:00:00Z');
    const prisma = criarPrismaMock(
      [contaAnalitica, contaN6, contaN5],
      [versaoRascunho],
      [{ tenantId: 't1', versaoId: 'v1', contaId: 'c7', exercicio: 2026, valor: new Prisma.Decimal(1000), updatedAt: updatedAtLido }],
    );
    // Simula outra escrita acontecendo entre o findUnique e o updateMany deste use-case.
    prisma.valorOrcadoConta.updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const useCase = new ConfigurarValorOrcadoContaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', contaId: 'c7', exercicio: 2026, valor: '2000' }),
    ).rejects.toThrow(ConflitoConcorrenciaError);
    expect(prisma.historicoOperacao.create).not.toHaveBeenCalled();
  });

  it('permite salvar sem token informado (retrocompatível) quando não há conflito real', async () => {
    const prisma = criarPrismaMock(
      [contaAnalitica, contaN6, contaN5],
      [versaoRascunho],
      [{ tenantId: 't1', versaoId: 'v1', contaId: 'c7', exercicio: 2026, valor: new Prisma.Decimal(1000) }],
    );
    const useCase = new ConfigurarValorOrcadoContaUseCase(prisma as never);

    const resultado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      versaoId: 'v1',
      contaId: 'c7',
      exercicio: 2026,
      valor: '2000',
    });

    expect(resultado.valor.toString()).toBe('2000');
    expect(prisma.historicoOperacao.create).toHaveBeenCalled();
  });
});
