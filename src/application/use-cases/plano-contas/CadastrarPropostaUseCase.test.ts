import { describe, expect, it, vi } from 'vitest';
import { CadastrarPropostaUseCase } from './CadastrarPropostaUseCase';
import { DatasPropostaInvalidasError, CamposObrigatoriosPropostaError } from '@/domain/plano-contas/errors';

type PropostaMock = { id: string; tenantId: string; codigo: string };

function criarPrismaMock(propostasExistentes: PropostaMock[] = []) {
  const propostas = [...propostasExistentes];
  let idSeq = 1;

  const base = {
    proposta: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; codigo: { startsWith: string } } }) => {
        const candidatas = propostas
          .filter((p) => p.tenantId === where.tenantId && p.codigo.startsWith(where.codigo.startsWith))
          .sort((a, b) => (a.codigo < b.codigo ? 1 : -1));
        return Promise.resolve(candidatas[0] ?? null);
      }),
      create: vi.fn(({ data }: { data: { tenantId: string; codigo: string } }) => {
        if (propostas.some((p) => p.tenantId === data.tenantId && p.codigo === data.codigo)) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
        const nova = { id: `p${idSeq++}`, ...data };
        propostas.push(nova);
        return Promise.resolve(nova);
      }),
    },
    versaoProposta: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'v1', ...data })),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base, propostas };
}

const inputValido = {
  tenantId: 't1',
  usuarioId: 'u1',
  tipo: 'CONTRATO' as const,
  nome: 'Projeto Alfa',
  dataInicio: new Date('2026-01-01'),
  dataFim: new Date('2026-12-31'),
  categoria: 'CONSOLIDADA' as const,
};

describe('CadastrarPropostaUseCase [US-102]', () => {
  it('cria Proposta e Versão 1 na mesma operação, com código gerado [Cenário 1]', async () => {
    const { base } = criarPrismaMock();
    const useCase = new CadastrarPropostaUseCase(base as never);

    const resultado = await useCase.execute(inputValido);

    expect(resultado.codigo).toMatch(/^PROP-\d{4}-0001$/);
    expect(resultado.status).toBe('RASCUNHO');
    expect(resultado.versaoInicial).toEqual(
      expect.objectContaining({ numeroVersao: 1, status: 'RASCUNHO', vigente: true, createdBy: 'u1' }),
    );
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'PROPOSTA_CRIADA' }) }),
    );
  });

  it('bloqueia campos obrigatórios em branco [Cenário 2]', async () => {
    const { base } = criarPrismaMock();
    const useCase = new CadastrarPropostaUseCase(base as never);

    await expect(useCase.execute({ ...inputValido, nome: '  ' })).rejects.toThrow(CamposObrigatoriosPropostaError);
    expect(base.proposta.create).not.toHaveBeenCalled();
  });

  it('bloqueia Data de Término <= Data de Início [Cenário 3]', async () => {
    const { base } = criarPrismaMock();
    const useCase = new CadastrarPropostaUseCase(base as never);

    await expect(
      useCase.execute({ ...inputValido, dataInicio: new Date('2026-06-01'), dataFim: new Date('2026-06-01') }),
    ).rejects.toThrow(DatasPropostaInvalidasError);
    expect(base.proposta.create).not.toHaveBeenCalled();
  });

  it('recalcula o código e tenta novamente em caso de colisão de concorrência', async () => {
    const ano = new Date().getFullYear();
    const { base } = criarPrismaMock([{ id: 'p0', tenantId: 't1', codigo: `PROP-${ano}-0001` }]);
    const useCase = new CadastrarPropostaUseCase(base as never);

    const resultado = await useCase.execute(inputValido);

    expect(resultado.codigo).toBe(`PROP-${ano}-0002`);
  });

  it('faz retry em caso de P2002 (colisão detectada só no create, corrida de verdade) [robustez de concorrência]', async () => {
    const { base } = criarPrismaMock();
    let chamadas = 0;
    base.proposta.create = vi.fn(({ data }: { data: { tenantId: string; codigo: string } }) => {
      chamadas++;
      if (chamadas === 1) {
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      }
      return Promise.resolve({ id: 'p-retry', ...data });
    });
    const useCase = new CadastrarPropostaUseCase(base as never);

    const resultado = await useCase.execute(inputValido);

    expect(chamadas).toBe(2);
    expect(resultado.id).toBe('p-retry');
  });
});
