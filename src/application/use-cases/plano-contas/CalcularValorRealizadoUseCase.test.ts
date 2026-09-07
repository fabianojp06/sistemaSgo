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

/**
 * REDE DE REGRESSÃO — agregação bottom-up, pré US-145 (Imposto sobre Conta
 * Sintética / ADR-050 C1).
 *
 * A US-145 vai inserir uma fase de "ajuste próprio da sintética" DEPOIS do
 * bottom-up (`agregar`), quebrando de propósito a invariante
 * "sintética = soma pura das filhas". Estes cenários CONGELAM a invariante
 * atual — enquanto ela ainda vale — para que a nova fase seja uma adição
 * consciente e não uma regressão silenciosa no Semáforo. Só alterar os
 * valores esperados aqui junto de uma decisão registrada na US-145.
 */
describe('CalcularValorRealizadoUseCase — invariante bottom-up (pré US-145)', () => {
  const no = (id: string, idPai: string | null, isAnalitica: boolean): ContaMock => ({
    id,
    idPai,
    isAnalitica,
    semaforoVerdePct: null,
    semaforoAmareloPct: null,
    semaforoLaranjaPct: null,
  });

  it('árvore de 3 níveis: sintética = soma exata das analíticas-folha, em cada nível', async () => {
    const prisma = criarPrismaMock({
      contas: [
        no('raiz', null, false),
        no('meio-a', 'raiz', false),
        no('meio-b', 'raiz', false),
        no('f1', 'meio-a', true),
        no('f2', 'meio-a', true),
        no('f3', 'meio-b', true),
      ],
      valoresOrcados: [
        { contaId: 'f1', valor: 1000 },
        { contaId: 'f2', valor: 1000 },
        { contaId: 'f3', valor: 1000 },
      ],
      itens: [
        { contaId: 'f1', valorTotal: 100 },
        { contaId: 'f2', valorTotal: 200 },
        { contaId: 'f3', valorTotal: 300 },
      ],
    });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const r = await useCase.execute('t1', 'v1', ['raiz', 'meio-a', 'meio-b', 'f1']);

    expect(r.get('f1')!.valorRealizado.toNumber()).toBe(100);
    expect(r.get('meio-a')!.valorRealizado.toNumber()).toBe(300); // 100 + 200
    expect(r.get('meio-b')!.valorRealizado.toNumber()).toBe(300);
    expect(r.get('raiz')!.valorRealizado.toNumber()).toBe(600); // soma pura das 3 folhas
    expect(r.get('raiz')!.valorOrcado.toNumber()).toBe(3000);
  });

  it('sintética com filha analítica + filha sintética: soma recursiva sem dupla contagem', async () => {
    const prisma = criarPrismaMock({
      contas: [
        no('raiz', null, false),
        no('an-direta', 'raiz', true),
        no('sub', 'raiz', false),
        no('an-neta', 'sub', true),
      ],
      itens: [
        { contaId: 'an-direta', valorTotal: 400 },
        { contaId: 'an-neta', valorTotal: 600 },
      ],
    });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const r = await useCase.execute('t1', 'v1', ['raiz', 'sub']);

    expect(r.get('sub')!.valorRealizado.toNumber()).toBe(600);
    expect(r.get('raiz')!.valorRealizado.toNumber()).toBe(1000);
  });

  it('sintética sem filhas: realizado 0, parcial false (não sinaliza cobertura incompleta)', async () => {
    const prisma = criarPrismaMock({ contas: [no('vazia', null, false)] });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const badge = (await useCase.execute('t1', 'v1', ['vazia'])).get('vazia')!;

    expect(badge.valorRealizado.toNumber()).toBe(0);
    expect(badge.valorOrcado.toNumber()).toBe(0);
    expect(badge.parcial).toBe(false);
  });

  it('conta inexistente no tenant: zeros e parcial true (comportamento atual documentado)', async () => {
    const prisma = criarPrismaMock({ contas: [no('c1', null, true)] });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const badge = (await useCase.execute('t1', 'v1', ['fantasma'])).get('fantasma')!;

    expect(badge.valorRealizado.toNumber()).toBe(0);
    expect(badge.parcial).toBe(true);
  });

  it('TRAVA US-145 — RateioImpostoGrade numa analítica hoje propaga para a sintética-pai via bottom-up', async () => {
    // Pós US-145, um rateio com contaId SINTÉTICA será somado direto na
    // sintética (fase C1), não via propagação. Este teste fixa o mundo atual:
    // rateio sempre em analítica, sempre propagado pelo `agregar`.
    const prisma = criarPrismaMock({
      contas: [no('raiz', null, false), no('f1', 'raiz', true), no('f2', 'raiz', true)],
      itens: [{ contaId: 'f1', valorTotal: 200000 }],
      rateiosImposto: [{ contaId: 'f1', valorDeclarado: 18500 }],
    });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const r = await useCase.execute('t1', 'v1', ['raiz', 'f1', 'f2']);

    expect(r.get('f1')!.valorRealizado.toNumber()).toBe(218500);
    expect(r.get('f2')!.valorRealizado.toNumber()).toBe(0);
    expect(r.get('raiz')!.valorRealizado.toNumber()).toBe(218500); // soma pura das filhas
  });

  it('GOLDEN — árvore + 4 fontes + overlap de Empregado: badge completo por conta', async () => {
    const propostaPeriodo = { dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-12-31') };
    const prisma = criarPrismaMock({
      propostaPeriodo,
      contas: [
        no('raiz', null, false),
        no('pessoal', 'raiz', true),
        no('viagens', 'raiz', false),
        no('c-passagem', 'viagens', true),
        no('c-diaria', 'viagens', true),
        no('c-transporte', 'viagens', true),
        no('bens', 'raiz', true),
      ],
      valoresOrcados: [
        { contaId: 'pessoal', valor: 100000 },
        { contaId: 'bens', valor: 50000 },
      ],
      empregados: [
        { contaId: 'pessoal', custoTotalMensal: 5000, periodoInicio: new Date('2026-01-01'), periodoFim: null }, // 12m
        { contaId: 'pessoal', custoTotalMensal: 3000, periodoInicio: new Date('2026-07-01'), periodoFim: null }, // 6m
      ],
      viagens: [
        {
          contaPassagemId: 'c-passagem',
          contaDiariaId: 'c-diaria',
          contaTransporteId: 'c-transporte',
          quantidadePessoas: 3,
          mediaDias: 4,
          custoUnitarioPassagem: 800,
          custoUnitarioDiaria: 250,
          custoUnitarioTransporte: 120,
        },
      ],
      itens: [{ contaId: 'bens', valorTotal: 45000 }],
      rateiosImposto: [{ contaId: 'pessoal', valorDeclarado: 8500 }],
    });
    const useCase = new CalcularValorRealizadoUseCase(prisma as never);

    const r = await useCase.execute('t1', 'v1', ['raiz', 'pessoal', 'viagens', 'bens']);

    const pessoal = 5000 * 12 + 3000 * 6 + 8500; // 86500
    const viagens = 800 * 3 + 250 * 3 * 4 + 120 * 3; // 2400 + 3000 + 360 = 5760
    const bens = 45000;

    expect(r.get('pessoal')!.valorRealizado.toNumber()).toBe(pessoal);
    expect(r.get('viagens')!.valorRealizado.toNumber()).toBe(viagens);
    expect(r.get('bens')!.valorRealizado.toNumber()).toBe(bens);
    expect(r.get('raiz')!.valorRealizado.toNumber()).toBe(pessoal + viagens + bens); // 137260
    expect(r.get('raiz')!.parcial).toBe(false);
  });
});
