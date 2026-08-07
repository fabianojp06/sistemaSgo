import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CalcularValorRealizadoUseCase } from './CalcularValorRealizadoUseCase';

type ContaMock = {
  id: string;
  idPai: string | null;
  isAnalitica: boolean;
  semaforoVerdePct: number | null;
  semaforoAmareloPct: number | null;
  semaforoLaranjaPct: number | null;
};

function criarPrismaMock(opts: {
  contas: ContaMock[];
  valoresOrcados?: { contaId: string; valor: number }[];
  viagens?: {
    contaPassagemId: string;
    contaDiariaId: string;
    contaTransporteId: string;
    quantidadePessoas: number;
    mediaDias: number;
    custoUnitarioPassagem: number;
    custoUnitarioDiaria: number;
    custoUnitarioTransporte: number;
  }[];
  itens?: { contaId: string; valorTotal: number }[];
  empregados?: { contaId: string; custoTotalMensal: number; periodoInicio?: Date; periodoFim?: Date | null }[];
  rateiosImposto?: { contaId: string; valorDeclarado: number }[];
  propostaPeriodo?: { dataInicio: Date; dataFim: Date };
}) {
  // Default: período de 1 mês só — mantém o multiplicador em 1 para os testes
  // que não testam sobreposição de período (ADR-032), sem precisar declarar
  // datas em cada cenário existente.
  const propostaPeriodo = opts.propostaPeriodo ?? { dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-01-31') };
  return {
    contaContabil: {
      findMany: vi.fn().mockResolvedValue(opts.contas),
    },
    valorOrcadoConta: {
      findMany: vi
        .fn()
        .mockResolvedValue((opts.valoresOrcados ?? []).map((v) => ({ contaId: v.contaId, valor: new Prisma.Decimal(v.valor) }))),
    },
    viagem: {
      findMany: vi.fn().mockResolvedValue(
        (opts.viagens ?? []).map((v) => ({
          ...v,
          custoUnitarioPassagem: new Prisma.Decimal(v.custoUnitarioPassagem),
          custoUnitarioDiaria: new Prisma.Decimal(v.custoUnitarioDiaria),
          custoUnitarioTransporte: new Prisma.Decimal(v.custoUnitarioTransporte),
        })),
      ),
    },
    itemPatrimonial: {
      findMany: vi.fn().mockResolvedValue((opts.itens ?? []).map((i) => ({ contaId: i.contaId, valorTotal: new Prisma.Decimal(i.valorTotal) }))),
    },
    versaoProposta: {
      findFirst: vi.fn().mockResolvedValue({ propostaId: 'p1', proposta: propostaPeriodo }),
    },
    empregadoHeadcount: {
      // custoTotalMensal do cenário de teste vira valorSalarioSnapshot (único
      // componente não-zero) — os outros 9 componentes/contas ficam zerados/
      // null por padrão, mesmo formato de campos que o use case seleciona de
      // fato (ADR-029).
      findMany: vi.fn().mockResolvedValue(
        (opts.empregados ?? []).map((e) => ({
          contaId: e.contaId,
          periodoInicio: e.periodoInicio ?? propostaPeriodo.dataInicio,
          periodoFim: e.periodoFim === undefined ? propostaPeriodo.dataFim : e.periodoFim,
          valorSalarioSnapshot: new Prisma.Decimal(e.custoTotalMensal),
          valorGratificacaoSnapshot: new Prisma.Decimal(0),
          contaGratificacaoId: null,
          valorEncargosSociaisSnapshot: new Prisma.Decimal(0),
          contaEncargosSociaisId: null,
          valorValeAlimentacaoSnapshot: new Prisma.Decimal(0),
          contaValeAlimentacaoId: null,
          valorValeRefeicaoSnapshot: new Prisma.Decimal(0),
          contaValeRefeicaoId: null,
          valorValeTransporteSnapshot: new Prisma.Decimal(0),
          contaValeTransporteId: null,
          valorPlanoOdontologicoSnapshot: new Prisma.Decimal(0),
          contaPlanoOdontologicoId: null,
          valorSeguroVidaSnapshot: new Prisma.Decimal(0),
          contaSeguroVidaId: null,
          valorPlanoSaudeSnapshot: new Prisma.Decimal(0),
          contaPlanoSaudeId: null,
          valorAuxilioCrecheSnapshot: new Prisma.Decimal(0),
          contaAuxilioCrecheId: null,
        })),
      ),
    },
    rateioImpostoGrade: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          (opts.rateiosImposto ?? []).map((r) => ({ contaId: r.contaId, valorDeclarado: new Prisma.Decimal(r.valorDeclarado) })),
        ),
    },
  };
}

const contaAnaliticaBase: ContaMock = {
  id: 'c1',
  idPai: null,
  isAnalitica: true,
  semaforoVerdePct: null,
  semaforoAmareloPct: null,
  semaforoLaranjaPct: null,
};

describe('CalcularValorRealizadoUseCase', () => {
  it('Cenário 1 — soma Viagem/ItemPatrimonial e não sinaliza parcial (ADR-027)', async () => {
    const prisma = criarPrismaMock({
      contas: [contaAnaliticaBase],
      valoresOrcados: [{ contaId: 'c1', valor: 100000 }],
      itens: [{ contaId: 'c1', valorTotal: 72000 }],
    });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const resultado = await useCase.execute('t1', 'v1', ['c1']);

    const badge = resultado.get('c1')!;
    expect(badge.valorRealizado.toNumber()).toBe(72000);
    expect(badge.percentual).toBe(72);
    expect(badge.cor).toBe('AMARELO'); // 72 > 70 (verde) e <= 85 (amarelo)
    expect(badge.parcial).toBe(false);
  });

  it('ADR-027 — soma Empregado (via contaId herdado do Cargo) e RateioImpostoGrade por conta', async () => {
    const prisma = criarPrismaMock({
      contas: [contaAnaliticaBase],
      valoresOrcados: [{ contaId: 'c1', valor: 1000 }],
      empregados: [{ contaId: 'c1', custoTotalMensal: 300 }],
      rateiosImposto: [{ contaId: 'c1', valorDeclarado: 100 }],
    });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const badge = (await useCase.execute('t1', 'v1', ['c1'])).get('c1')!;
    expect(badge.valorRealizado.toNumber()).toBe(400);
    expect(badge.parcial).toBe(false);
  });

  it('ADR-032 — multiplica componentes de Empregado pelos meses de sobreposição com o período da Proposta', async () => {
    const propostaPeriodo = { dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-12-31') }; // 12 meses
    const prisma = criarPrismaMock({
      contas: [contaAnaliticaBase],
      propostaPeriodo,
      empregados: [
        // Começa em junho, sem periodoFim (usa dataFim da Proposta) → overlap jun-dez = 7 meses.
        { contaId: 'c1', custoTotalMensal: 300, periodoInicio: new Date('2026-06-01'), periodoFim: null },
      ],
    });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const badge = (await useCase.execute('t1', 'v1', ['c1'])).get('c1')!;
    expect(badge.valorRealizado.toNumber()).toBe(2100); // 300 * 7 meses, não 300 * 12
  });

  it('ADR-032 — Empregado fora do período da Proposta não contribui', async () => {
    const propostaPeriodo = { dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-06-30') };
    const prisma = criarPrismaMock({
      contas: [contaAnaliticaBase],
      propostaPeriodo,
      empregados: [{ contaId: 'c1', custoTotalMensal: 300, periodoInicio: new Date('2026-08-01'), periodoFim: new Date('2026-12-31') }],
    });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const badge = (await useCase.execute('t1', 'v1', ['c1'])).get('c1')!;
    expect(badge.valorRealizado.toNumber()).toBe(0);
  });

  it('usa limiares próprios da conta quando configurados', async () => {
    const prisma = criarPrismaMock({
      contas: [{ ...contaAnaliticaBase, semaforoVerdePct: 50, semaforoAmareloPct: 80, semaforoLaranjaPct: 95 }],
      valoresOrcados: [{ contaId: 'c1', valor: 1000 }],
      itens: [{ contaId: 'c1', valorTotal: 600 }],
    });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const badge = (await useCase.execute('t1', 'v1', ['c1'])).get('c1')!;
    expect(badge.percentual).toBe(60);
    expect(badge.cor).toBe('AMARELO'); // 60 > 50 (verde), <= 80 (amarelo)
  });

  it('Cenário 3 — conta sintética agrega filhos (herda parcial se algum filho estiver parcial)', async () => {
    const sintetica: ContaMock = { ...contaAnaliticaBase, id: 'raiz', isAnalitica: false };
    const filha1: ContaMock = { ...contaAnaliticaBase, id: 'f1', idPai: 'raiz' };
    const filha2: ContaMock = { ...contaAnaliticaBase, id: 'f2', idPai: 'raiz' };
    const prisma = criarPrismaMock({
      contas: [sintetica, filha1, filha2],
      valoresOrcados: [
        { contaId: 'f1', valor: 1000 },
        { contaId: 'f2', valor: 1000 },
      ],
      itens: [
        { contaId: 'f1', valorTotal: 500 },
        { contaId: 'f2', valorTotal: 300 },
      ],
    });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const badge = (await useCase.execute('t1', 'v1', ['raiz'])).get('raiz')!;
    expect(badge.valorOrcado.toNumber()).toBe(2000);
    expect(badge.valorRealizado.toNumber()).toBe(800);
    expect(badge.parcial).toBe(false);
  });

  it('conta sem valorOrcado retorna percentual/cor nulos, sem dividir por zero', async () => {
    const prisma = criarPrismaMock({ contas: [contaAnaliticaBase] });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const badge = (await useCase.execute('t1', 'v1', ['c1'])).get('c1')!;
    expect(badge.percentual).toBeNull();
    expect(badge.cor).toBeNull();
  });

  it('Viagem soma passagem*pessoas + diária*pessoas*dias + transporte*pessoas em contas distintas', async () => {
    const prisma = criarPrismaMock({
      contas: [
        { ...contaAnaliticaBase, id: 'passagem' },
        { ...contaAnaliticaBase, id: 'diaria' },
        { ...contaAnaliticaBase, id: 'transporte' },
      ],
      viagens: [
        {
          contaPassagemId: 'passagem',
          contaDiariaId: 'diaria',
          contaTransporteId: 'transporte',
          quantidadePessoas: 2,
          mediaDias: 3,
          custoUnitarioPassagem: 500,
          custoUnitarioDiaria: 100,
          custoUnitarioTransporte: 50,
        },
      ],
    });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const resultado = await useCase.execute('t1', 'v1', ['passagem', 'diaria', 'transporte']);
    expect(resultado.get('passagem')!.valorRealizado.toNumber()).toBe(1000); // 500*2
    expect(resultado.get('diaria')!.valorRealizado.toNumber()).toBe(600); // 100*2*3
    expect(resultado.get('transporte')!.valorRealizado.toNumber()).toBe(100); // 50*2
  });
});
