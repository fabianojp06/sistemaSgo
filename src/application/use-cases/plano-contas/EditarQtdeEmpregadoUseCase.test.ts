import { describe, expect, it, vi } from 'vitest';
import { EditarQtdeEmpregadoUseCase } from './EditarQtdeEmpregadoUseCase';
import { QtdeEmpregadoPropostaImutavelError, SobreposicaoPeriodoQtdeEmpregadoError } from '@/domain/plano-contas/errors';

type QtdeMock = {
  id: string;
  tenantId: string;
  propostaId: string;
  metaId: string | null;
  periodoInicio: Date;
  periodoFim: Date;
  numeroDocumento: string;
  quantidadeEmpregados: number;
  quantidadeEstagiarios: number;
  quantidadeJovemAprendiz: number;
  ativo: boolean;
};
type PropostaMock = { id: string; tenantId: string; status: string; dataInicio: Date; dataFim: Date };
type HeadcountMock = { tenantId: string; propostaId: string; metaId: string | null; categoria: string; ativo: boolean };

function criarPrismaMock(qtde: QtdeMock, proposta: PropostaMock, headcounts: HeadcountMock[] = [], outras: QtdeMock[] = []) {
  let atual = { ...qtde };

  const base = {
    qtdeEmpregado: {
      findFirst: vi.fn(() => Promise.resolve(atual.ativo ? atual : null)),
      findMany: vi.fn(() => Promise.resolve(outras.filter((e) => e.ativo))),
      update: vi.fn(({ data }: { data: Partial<QtdeMock> }) => {
        atual = { ...atual, ...data };
        return Promise.resolve(atual);
      }),
    },
    proposta: {
      findFirst: vi.fn(() => Promise.resolve(proposta)),
    },
    empregadoHeadcount: {
      count: vi.fn(({ where }: { where: { categoria: string; metaId?: string } }) =>
        Promise.resolve(headcounts.filter((h) => h.categoria === where.categoria && (where.metaId === undefined || h.metaId === where.metaId)).length),
      ),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base, getAtual: () => atual };
}

const qtdeBase: QtdeMock = {
  id: 'q1',
  tenantId: 't1',
  propostaId: 'p1',
  metaId: null,
  periodoInicio: new Date('2026-01-01'),
  periodoFim: new Date('2026-06-30'),
  numeroDocumento: 'APOST-2026-014',
  quantidadeEmpregados: 5,
  quantidadeEstagiarios: 0,
  quantidadeJovemAprendiz: 0,
  ativo: true,
};
const propostaRascunho: PropostaMock = { id: 'p1', tenantId: 't1', status: 'RASCUNHO', dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-12-31') };
const propostaOficializada: PropostaMock = { id: 'p1', tenantId: 't1', status: 'OFICIALIZADO', dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-12-31') };

describe('EditarQtdeEmpregadoUseCase [US-113]', () => {
  it('recalcula quantitativos ao editar o Número do Documento [Cenário 5]', async () => {
    const headcounts: HeadcountMock[] = [
      { tenantId: 't1', propostaId: 'p1', metaId: null, categoria: 'EMPREGADO', ativo: true },
      { tenantId: 't1', propostaId: 'p1', metaId: null, categoria: 'EMPREGADO', ativo: true },
      { tenantId: 't1', propostaId: 'p1', metaId: null, categoria: 'EMPREGADO', ativo: true },
      { tenantId: 't1', propostaId: 'p1', metaId: null, categoria: 'EMPREGADO', ativo: true },
      { tenantId: 't1', propostaId: 'p1', metaId: null, categoria: 'EMPREGADO', ativo: true },
      { tenantId: 't1', propostaId: 'p1', metaId: null, categoria: 'EMPREGADO', ativo: true },
      { tenantId: 't1', propostaId: 'p1', metaId: null, categoria: 'EMPREGADO', ativo: true },
    ];
    const { base, getAtual } = criarPrismaMock(qtdeBase, propostaRascunho, headcounts);
    const useCase = new EditarQtdeEmpregadoUseCase(base as never);

    const qtde = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      qtdeEmpregadoId: 'q1',
      periodoInicio: new Date('2026-01-01'),
      periodoFim: new Date('2026-06-30'),
      numeroDocumento: 'APOST-2026-014-REV',
    });

    expect(qtde.quantidadeEmpregados).toBe(7);
    expect(getAtual().propostaId).toBe('p1');
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'QTDE_EMPREGADO_EDITADA' }) }),
    );
  });

  it('bloqueia edição quando a Proposta não está em RASCUNHO/EM_ELABORACAO [Cenário 6]', async () => {
    const { base } = criarPrismaMock(qtdeBase, propostaOficializada);
    const useCase = new EditarQtdeEmpregadoUseCase(base as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        qtdeEmpregadoId: 'q1',
        periodoInicio: new Date('2026-01-01'),
        periodoFim: new Date('2026-06-30'),
        numeroDocumento: 'APOST-2026-014-REV',
      }),
    ).rejects.toThrow(QtdeEmpregadoPropostaImutavelError);
  });

  it('bloqueia sobreposição com outro período ativo', async () => {
    const outras: QtdeMock[] = [{ ...qtdeBase, id: 'q2', periodoInicio: new Date('2026-08-01'), periodoFim: new Date('2026-10-31') }];
    const { base } = criarPrismaMock(qtdeBase, propostaRascunho, [], outras);
    const useCase = new EditarQtdeEmpregadoUseCase(base as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        qtdeEmpregadoId: 'q1',
        periodoInicio: new Date('2026-07-01'),
        periodoFim: new Date('2026-09-30'),
        numeroDocumento: 'APOST-2026-014-REV',
      }),
    ).rejects.toThrow(SobreposicaoPeriodoQtdeEmpregadoError);
  });
});
