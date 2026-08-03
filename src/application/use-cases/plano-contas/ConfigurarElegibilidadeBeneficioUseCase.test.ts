import { describe, expect, it, vi } from 'vitest';
import { ConfigurarElegibilidadeBeneficioUseCase } from './ConfigurarElegibilidadeBeneficioUseCase';
import {
  BeneficioIndisponivelNoCargoError,
  CamposObrigatoriosBeneficioError,
  VigenciaBeneficioForaDaPropostaError,
} from '@/domain/plano-contas/errors';

type CargoMock = {
  vaAtivo: boolean;
  vrAtivo: boolean;
  planoSaudeAtivo: boolean;
  planoOdontoAtivo: boolean;
  seguroVidaAtivo: boolean;
  auxilioCrecheAtivo: boolean;
  transporteAtivo: boolean;
};
type EmpregadoMock = { id: string; tenantId: string; propostaId: string; nome: string; categoria: string; ativo: boolean; cargo: CargoMock };
type PropostaMock = { id: string; tenantId: string; dataInicio: Date; dataFim: Date };
type ElegibilidadeMock = {
  id: string;
  tenantId: string;
  empregadoId: string;
  tipoBeneficio: string;
  ativo: boolean;
  periodoInicio: Date | null;
  periodoFim: Date | null;
  numeroDependentes: number;
};

function criarPrismaMock(empregado: EmpregadoMock, proposta: PropostaMock, elegibilidadeExistente: ElegibilidadeMock | null = null) {
  let atual = elegibilidadeExistente ? { ...elegibilidadeExistente } : null;
  let idSeq = 1;

  const base = {
    empregadoHeadcount: { findFirst: vi.fn(() => Promise.resolve(empregado)) },
    proposta: { findFirst: vi.fn(() => Promise.resolve(proposta)) },
    empregadoBeneficioElegibilidade: {
      findUnique: vi.fn(() => Promise.resolve(atual)),
      upsert: vi.fn(({ create, update }: { create: Omit<ElegibilidadeMock, 'id'>; update: Partial<ElegibilidadeMock> }) => {
        atual = atual ? { ...atual, ...update } : { id: `el${idSeq++}`, ...create };
        return Promise.resolve(atual);
      }),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const propostaBase: PropostaMock = { id: 'p1', tenantId: 't1', dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-12-31') };

function empregadoComCargo(overrides: Partial<CargoMock> = {}, categoria = 'EMPREGADO'): EmpregadoMock {
  return {
    id: 'e1',
    tenantId: 't1',
    propostaId: 'p1',
    nome: 'Maria da Silva',
    categoria,
    ativo: true,
    cargo: {
      vaAtivo: false,
      vrAtivo: false,
      planoSaudeAtivo: false,
      planoOdontoAtivo: false,
      seguroVidaAtivo: false,
      auxilioCrecheAtivo: false,
      transporteAtivo: false,
      ...overrides,
    },
  };
}

describe('ConfigurarElegibilidadeBeneficioUseCase [US-108a]', () => {
  it('ativa elegibilidade de benefício disponível no Cargo [Cenário 1]', async () => {
    const empregado = empregadoComCargo({ planoSaudeAtivo: true });
    const prisma = criarPrismaMock(empregado, propostaBase);
    const useCase = new ConfigurarElegibilidadeBeneficioUseCase(prisma as never);

    const elegibilidade = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      empregadoId: 'e1',
      tipoBeneficio: 'PLANO_SAUDE',
      ativo: true,
      periodoInicio: new Date('2026-02-01'),
      periodoFim: new Date('2026-12-31'),
      numeroDependentes: 2,
    });

    expect(elegibilidade.ativo).toBe(true);
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'BENEFICIO_ELEGIBILIDADE_CONFIGURADA' }) }),
    );
  });

  it('bloqueia elegibilidade de benefício indisponível no Cargo [Cenário 2]', async () => {
    const empregado = empregadoComCargo({ planoOdontoAtivo: false });
    const prisma = criarPrismaMock(empregado, propostaBase);
    const useCase = new ConfigurarElegibilidadeBeneficioUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        empregadoId: 'e1',
        tipoBeneficio: 'PLANO_ODONTO',
        ativo: true,
        periodoInicio: new Date('2026-02-01'),
        numeroDependentes: 1,
      }),
    ).rejects.toThrow(BeneficioIndisponivelNoCargoError);
  });

  it('bloqueia período fora da vigência da Proposta [Cenário 3, RN0252]', async () => {
    const empregado = empregadoComCargo({ vaAtivo: true });
    const prisma = criarPrismaMock(empregado, propostaBase);
    const useCase = new ConfigurarElegibilidadeBeneficioUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        empregadoId: 'e1',
        tipoBeneficio: 'VA',
        ativo: true,
        periodoInicio: new Date('2026-02-01'),
        periodoFim: new Date('2027-01-15'),
        numeroDependentes: 1,
      }),
    ).rejects.toThrow(VigenciaBeneficioForaDaPropostaError);
  });

  it('bloqueia categoria EMPREGADO sem período/dependentes em benefício obrigatório [Cenário 4, RN0253]', async () => {
    const empregado = empregadoComCargo({ vaAtivo: true });
    const prisma = criarPrismaMock(empregado, propostaBase);
    const useCase = new ConfigurarElegibilidadeBeneficioUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        empregadoId: 'e1',
        tipoBeneficio: 'VA',
        ativo: true,
      }),
    ).rejects.toThrow(CamposObrigatoriosBeneficioError);
  });

  it('aceita Vale Transporte desativado sem período/dependentes [Cenário 5]', async () => {
    const empregado = empregadoComCargo({ transporteAtivo: true });
    const prisma = criarPrismaMock(empregado, propostaBase);
    const useCase = new ConfigurarElegibilidadeBeneficioUseCase(prisma as never);

    const elegibilidade = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      empregadoId: 'e1',
      tipoBeneficio: 'VALE_TRANSPORTE',
      ativo: false,
    });

    expect(elegibilidade.ativo).toBe(false);
  });

  it('edita elegibilidade existente, registrando BENEFICIO_ELEGIBILIDADE_EDITADA [Cenário 6]', async () => {
    const empregado = empregadoComCargo({ vrAtivo: true });
    const existente: ElegibilidadeMock = {
      id: 'el1',
      tenantId: 't1',
      empregadoId: 'e1',
      tipoBeneficio: 'VR',
      ativo: true,
      periodoInicio: new Date('2026-02-01'),
      periodoFim: new Date('2026-12-31'),
      numeroDependentes: 1,
    };
    const prisma = criarPrismaMock(empregado, propostaBase, existente);
    const useCase = new ConfigurarElegibilidadeBeneficioUseCase(prisma as never);

    const elegibilidade = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      empregadoId: 'e1',
      tipoBeneficio: 'VR',
      ativo: false,
    });

    expect(elegibilidade.ativo).toBe(false);
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'BENEFICIO_ELEGIBILIDADE_EDITADA' }) }),
    );
  });

  it('não exige período/dependentes para categoria diferente de EMPREGADO', async () => {
    const empregado = empregadoComCargo({ vaAtivo: true }, 'ESTAGIARIO');
    const prisma = criarPrismaMock(empregado, propostaBase);
    const useCase = new ConfigurarElegibilidadeBeneficioUseCase(prisma as never);

    const elegibilidade = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      empregadoId: 'e1',
      tipoBeneficio: 'VA',
      ativo: true,
    });

    expect(elegibilidade.ativo).toBe(true);
  });
});
