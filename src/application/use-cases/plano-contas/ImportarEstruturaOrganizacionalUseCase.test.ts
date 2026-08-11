import { describe, expect, it, vi } from 'vitest';
import { ImportarEstruturaOrganizacionalUseCase } from './ImportarEstruturaOrganizacionalUseCase';
import {
  EstruturaOrigemVaziaError,
  ImportacaoEstruturaBloqueadaPorCargoVinculadoError,
  PropostaImutavelError,
  PropostaNaoEncontradaError,
} from '@/domain/plano-contas/errors';

type PropostaMock = { id: string; tenantId: string; nome: string; status: string };
type UnidadeMock = {
  id: string;
  tenantId: string;
  propostaId: string;
  nome: string;
  tipoNivel: string;
  idPai: string | null;
  ativa: boolean;
  createdAt: Date;
  temCargo?: boolean;
};

let idSeq = 1;

function criarPrismaMock(propostas: PropostaMock[], unidadesIniciais: UnidadeMock[]) {
  const propostasPorId = new Map(propostas.map((p) => [p.id, p]));
  const unidades: UnidadeMock[] = [...unidadesIniciais];

  const base = {
    proposta: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        const p = propostasPorId.get(where.id);
        return Promise.resolve(p && p.tenantId === where.tenantId ? p : null);
      }),
    },
    unidadeFuncional: {
      findMany: vi.fn(
        ({
          where,
          select,
        }: {
          where: { tenantId: string; propostaId: string; ativa: boolean; alocacoesCargo?: { some: object } };
          select?: { id: boolean; nome: boolean };
        }) => {
          let resultado = unidades.filter(
            (u) => u.tenantId === where.tenantId && u.propostaId === where.propostaId && u.ativa === where.ativa,
          );
          if (where.alocacoesCargo) {
            resultado = resultado.filter((u) => u.temCargo);
          }
          if (select) {
            return Promise.resolve(resultado.map((u) => ({ id: u.id, nome: u.nome })));
          }
          return Promise.resolve(resultado);
        },
      ),
      updateMany: vi.fn(({ where, data }: { where: { id: { in: string[] } }; data: { ativa: boolean } }) => {
        let count = 0;
        for (const u of unidades) {
          if (where.id.in.includes(u.id)) {
            u.ativa = data.ativa;
            count++;
          }
        }
        return Promise.resolve({ count });
      }),
      create: vi.fn(
        ({
          data,
        }: {
          data: { tenantId: string; propostaId: string; nome: string; tipoNivel: string; idPai: string | null };
        }) => {
          const nova: UnidadeMock = {
            id: `u-${idSeq++}`,
            tenantId: data.tenantId,
            propostaId: data.propostaId,
            nome: data.nome,
            tipoNivel: data.tipoNivel,
            idPai: data.idPai,
            ativa: true,
            createdAt: new Date(),
          };
          unidades.push(nova);
          return Promise.resolve(nova);
        },
      ),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { prisma: base, unidades };
}

const propostaOrigem: PropostaMock = { id: 'origem', tenantId: 't1', nome: 'Proposta Origem', status: 'OFICIALIZADO' };
const propostaDestino: PropostaMock = { id: 'destino', tenantId: 't1', nome: 'Proposta Destino', status: 'RASCUNHO' };
const propostaDestinoImutavel: PropostaMock = { id: 'destino2', tenantId: 't1', nome: 'Proposta Destino 2', status: 'OFICIALIZADO' };

describe('ImportarEstruturaOrganizacionalUseCase [US-130]', () => {
  it('importa árvore Sintético→Analítico remapeando idPai [Cenário 1]', async () => {
    const diretoria: UnidadeMock = {
      id: 'dir',
      tenantId: 't1',
      propostaId: 'origem',
      nome: 'Diretoria Executiva',
      tipoNivel: 'SINTETICO_DIRETORIA',
      idPai: null,
      ativa: true,
      createdAt: new Date('2026-01-01'),
    };
    const assessoria: UnidadeMock = {
      id: 'assessoria',
      tenantId: 't1',
      propostaId: 'origem',
      nome: 'Assessoria de Planejamento',
      tipoNivel: 'ANALITICO_ASSESSOR',
      idPai: 'dir',
      ativa: true,
      createdAt: new Date('2026-01-02'),
    };
    const { prisma, unidades } = criarPrismaMock([propostaOrigem, propostaDestino], [diretoria, assessoria]);
    const useCase = new ImportarEstruturaOrganizacionalUseCase(prisma as never);

    const resultado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaOrigemId: 'origem',
      propostaDestinoId: 'destino',
    });

    expect(resultado).toEqual({ unidadesInativadas: 0, unidadesCriadas: 2 });

    const criadasNaDestino = unidades.filter((u) => u.propostaId === 'destino');
    expect(criadasNaDestino).toHaveLength(2);
    const diretoriaNova = criadasNaDestino.find((u) => u.nome === 'Diretoria Executiva')!;
    const assessoriaNova = criadasNaDestino.find((u) => u.nome === 'Assessoria de Planejamento')!;
    expect(diretoriaNova.idPai).toBeNull();
    expect(assessoriaNova.idPai).toBe(diretoriaNova.id); // remapeado — não aponta mais para 'dir' (id da origem)

    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipoOperacao: 'ESTRUTURA_ORGANIZACIONAL_IMPORTADA' }),
      }),
    );
  });

  it('inativa organograma parcial existente na destino antes de importar [Cenário 2]', async () => {
    const diretoria: UnidadeMock = {
      id: 'dir',
      tenantId: 't1',
      propostaId: 'origem',
      nome: 'Diretoria',
      tipoNivel: 'SINTETICO_DIRETORIA',
      idPai: null,
      ativa: true,
      createdAt: new Date(),
    };
    const gerenciaExistente: UnidadeMock = {
      id: 'ger-existente',
      tenantId: 't1',
      propostaId: 'destino',
      nome: 'Gerência Financeira',
      tipoNivel: 'SINTETICO_GERENCIA',
      idPai: null,
      ativa: true,
      createdAt: new Date(),
    };
    const { prisma, unidades } = criarPrismaMock([propostaOrigem, propostaDestino], [diretoria, gerenciaExistente]);
    const useCase = new ImportarEstruturaOrganizacionalUseCase(prisma as never);

    const resultado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaOrigemId: 'origem',
      propostaDestinoId: 'destino',
    });

    expect(resultado.unidadesInativadas).toBe(1);
    expect(unidades.find((u) => u.id === 'ger-existente')!.ativa).toBe(false);
  });

  it('bloqueia a importação inteira se a destino tem Cargo vinculado [Cenário 4]', async () => {
    const diretoria: UnidadeMock = {
      id: 'dir',
      tenantId: 't1',
      propostaId: 'origem',
      nome: 'Diretoria',
      tipoNivel: 'SINTETICO_DIRETORIA',
      idPai: null,
      ativa: true,
      createdAt: new Date(),
    };
    const setorComCargo: UnidadeMock = {
      id: 'setor-compras',
      tenantId: 't1',
      propostaId: 'destino',
      nome: 'Setor de Compras',
      tipoNivel: 'ANALITICO_SETOR',
      idPai: null,
      ativa: true,
      createdAt: new Date(),
      temCargo: true,
    };
    const { prisma, unidades } = criarPrismaMock([propostaOrigem, propostaDestino], [diretoria, setorComCargo]);
    const useCase = new ImportarEstruturaOrganizacionalUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaOrigemId: 'origem', propostaDestinoId: 'destino' }),
    ).rejects.toThrow(ImportacaoEstruturaBloqueadaPorCargoVinculadoError);

    // nenhuma escrita ocorreu
    expect(unidades.filter((u) => u.propostaId === 'origem' || u.id === 'setor-compras')).toHaveLength(2);
    expect(prisma.historicoOperacao.create).not.toHaveBeenCalled();
  });

  it('bloqueia se a Proposta origem não tem Estrutura Organizacional [Cenário 7]', async () => {
    const { prisma } = criarPrismaMock([propostaOrigem, propostaDestino], []);
    const useCase = new ImportarEstruturaOrganizacionalUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaOrigemId: 'origem', propostaDestinoId: 'destino' }),
    ).rejects.toThrow(EstruturaOrigemVaziaError);
  });

  it('bloqueia se a Proposta destino não está Rascunho/Em Elaboração [Cenário 6]', async () => {
    const diretoria: UnidadeMock = {
      id: 'dir',
      tenantId: 't1',
      propostaId: 'origem',
      nome: 'Diretoria',
      tipoNivel: 'SINTETICO_DIRETORIA',
      idPai: null,
      ativa: true,
      createdAt: new Date(),
    };
    const { prisma } = criarPrismaMock([propostaOrigem, propostaDestinoImutavel], [diretoria]);
    const useCase = new ImportarEstruturaOrganizacionalUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaOrigemId: 'origem', propostaDestinoId: 'destino2' }),
    ).rejects.toThrow(PropostaImutavelError);
  });

  it('bloqueia se a Proposta origem ou destino não existe', async () => {
    const { prisma } = criarPrismaMock([propostaDestino], []);
    const useCase = new ImportarEstruturaOrganizacionalUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaOrigemId: 'inexistente', propostaDestinoId: 'destino' }),
    ).rejects.toThrow(PropostaNaoEncontradaError);
  });
});
