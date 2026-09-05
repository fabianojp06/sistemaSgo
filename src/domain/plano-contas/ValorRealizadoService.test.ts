import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ValorRealizadoService } from './ValorRealizadoService';

/**
 * REDE DE REGRESSÃO — pré US-145 (Imposto sobre Conta Sintética / ADR-050 C1).
 *
 * `ValorRealizadoService` foi extraído de `CalcularValorRealizadoUseCase` mas
 * nunca ganhou teste próprio — só era exercitado de raspão pelo teste do use
 * case. A US-145 vai inserir uma fase `aplicarImpostosPorConta(...)` DEPOIS da
 * agregação e passar a aceitar `RateioImpostoGrade.contaId` sintética.
 *
 * Estes testes CONGELAM o comportamento atual de `somarPorContaAnalitica`
 * (mapa bruto por conta analítica, antes de qualquer hierarquia) para que a
 * nova fase não introduza divergência silenciosa em Semáforo / dashboard
 * US-118 / Cronograma. NÃO alterar os valores esperados ao implementar a
 * US-145 sem uma decisão explícita registrada — divergência aqui é o alarme.
 */

type EmpregadoRow = {
  contaId: string;
  periodoInicio: Date;
  periodoFim: Date | null;
  valorSalarioSnapshot: number;
  valorGratificacaoSnapshot?: number;
  contaGratificacaoId?: string | null;
  valorEncargosSociaisSnapshot?: number;
  contaEncargosSociaisId?: string | null;
};

function criarPrismaMock(opts: {
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
  empregados?: EmpregadoRow[];
  rateiosImposto?: { contaId: string; valorDeclarado: number }[];
  propostaPeriodo?: { dataInicio: Date; dataFim: Date };
  versaoEncontrada?: boolean;
}) {
  const propostaPeriodo =
    opts.propostaPeriodo ?? { dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-01-31') };

  return {
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
      findMany: vi
        .fn()
        .mockResolvedValue((opts.itens ?? []).map((i) => ({ contaId: i.contaId, valorTotal: new Prisma.Decimal(i.valorTotal) }))),
    },
    versaoProposta: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          opts.versaoEncontrada === false ? null : { propostaId: 'p1', proposta: propostaPeriodo },
        ),
    },
    empregadoHeadcount: {
      findMany: vi.fn().mockResolvedValue(
        (opts.empregados ?? []).map((e) => ({
          contaId: e.contaId,
          periodoInicio: e.periodoInicio,
          periodoFim: e.periodoFim,
          valorSalarioSnapshot: new Prisma.Decimal(e.valorSalarioSnapshot),
          valorGratificacaoSnapshot: new Prisma.Decimal(e.valorGratificacaoSnapshot ?? 0),
          contaGratificacaoId: e.contaGratificacaoId ?? null,
          valorEncargosSociaisSnapshot: new Prisma.Decimal(e.valorEncargosSociaisSnapshot ?? 0),
          contaEncargosSociaisId: e.contaEncargosSociaisId ?? null,
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

function objeto(mapa: Map<string, Prisma.Decimal>): Record<string, number> {
  return Object.fromEntries(Array.from(mapa.entries()).map(([k, v]) => [k, v.toNumber()]));
}

describe('ValorRealizadoService.somarPorContaAnalitica — rede de regressão (pré US-145)', () => {
  it('Viagem: passagem*pessoas + diária*pessoas*dias + transporte*pessoas, cada componente na sua conta', async () => {
    const prisma = criarPrismaMock({
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

    const mapa = await new ValorRealizadoService(prisma as never).somarPorContaAnalitica('t1', 'v1');

    expect(objeto(mapa)).toEqual({ passagem: 1000, diaria: 600, transporte: 100 });
  });

  it('Viagem: componentes que caem na mesma conta são somados, não sobrescritos', async () => {
    const prisma = criarPrismaMock({
      viagens: [
        {
          contaPassagemId: 'c1',
          contaDiariaId: 'c1',
          contaTransporteId: 'c1',
          quantidadePessoas: 1,
          mediaDias: 2,
          custoUnitarioPassagem: 500,
          custoUnitarioDiaria: 100,
          custoUnitarioTransporte: 50,
        },
      ],
    });

    const mapa = await new ValorRealizadoService(prisma as never).somarPorContaAnalitica('t1', 'v1');

    expect(objeto(mapa)).toEqual({ c1: 750 }); // 500 + 100*2 + 50
  });

  it('ItemPatrimonial: valorTotal somado como está, agrupado por conta', async () => {
    const prisma = criarPrismaMock({
      itens: [
        { contaId: 'a', valorTotal: 1200 },
        { contaId: 'a', valorTotal: 800 },
        { contaId: 'b', valorTotal: 300 },
      ],
    });

    const mapa = await new ValorRealizadoService(prisma as never).somarPorContaAnalitica('t1', 'v1');

    expect(objeto(mapa)).toEqual({ a: 2000, b: 300 });
  });

  it('Empregado: cada componente multiplicado pelos meses de sobreposição com o período da Proposta', async () => {
    const prisma = criarPrismaMock({
      propostaPeriodo: { dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-12-31') },
      empregados: [
        { contaId: 'sal', periodoInicio: new Date('2026-01-01'), periodoFim: null, valorSalarioSnapshot: 1000 },
      ],
    });

    const mapa = await new ValorRealizadoService(prisma as never).somarPorContaAnalitica('t1', 'v1');

    expect(objeto(mapa)).toEqual({ sal: 12000 }); // 1000 * 12 meses
  });

  it('Empregado: componente com conta própria vai para ela; sem conta, cai na conta de salário (ADR-029)', async () => {
    const prisma = criarPrismaMock({
      propostaPeriodo: { dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-06-30') }, // 6 meses
      empregados: [
        {
          contaId: 'sal',
          periodoInicio: new Date('2026-01-01'),
          periodoFim: null,
          valorSalarioSnapshot: 1000,
          valorGratificacaoSnapshot: 200,
          contaGratificacaoId: 'grat',
          valorEncargosSociaisSnapshot: 300,
          contaEncargosSociaisId: null, // sem conta → cai em 'sal'
        },
      ],
    });

    const mapa = await new ValorRealizadoService(prisma as never).somarPorContaAnalitica('t1', 'v1');

    // sal = (1000 + 300) * 6 ; grat = 200 * 6
    expect(objeto(mapa)).toEqual({ sal: 7800, grat: 1200 });
  });

  it('Empregado totalmente fora do período da Proposta não contribui', async () => {
    const prisma = criarPrismaMock({
      propostaPeriodo: { dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-06-30') },
      empregados: [
        { contaId: 'sal', periodoInicio: new Date('2026-08-01'), periodoFim: new Date('2026-12-31'), valorSalarioSnapshot: 1000 },
      ],
    });

    const mapa = await new ValorRealizadoService(prisma as never).somarPorContaAnalitica('t1', 'v1');

    expect(objeto(mapa)).toEqual({});
  });

  it('versão inexistente: Empregados são ignorados, demais fontes seguem', async () => {
    const prisma = criarPrismaMock({
      versaoEncontrada: false,
      itens: [{ contaId: 'a', valorTotal: 500 }],
      empregados: [
        { contaId: 'sal', periodoInicio: new Date('2026-01-01'), periodoFim: null, valorSalarioSnapshot: 1000 },
      ],
    });

    const mapa = await new ValorRealizadoService(prisma as never).somarPorContaAnalitica('t1', 'v1');

    expect(objeto(mapa)).toEqual({ a: 500 });
    expect(prisma.empregadoHeadcount.findMany).not.toHaveBeenCalled();
  });

  it('TRAVA US-145 — hoje RateioImpostoGrade.valorDeclarado entra direto na sua contaId, sem distinção analítica/sintética', async () => {
    // Pré US-145 toda contaId de rateio é analítica (ADR-027). Este teste
    // documenta que o serviço NÃO trata sintética de forma diferente hoje —
    // a fase C1 da US-145 muda exatamente este ponto e deve ser deliberada.
    const prisma = criarPrismaMock({
      rateiosImposto: [
        { contaId: 'analitica-1', valorDeclarado: 900 },
        { contaId: 'analitica-1', valorDeclarado: 100 },
        { contaId: 'analitica-2', valorDeclarado: 250 },
      ],
    });

    const mapa = await new ValorRealizadoService(prisma as never).somarPorContaAnalitica('t1', 'v1');

    expect(objeto(mapa)).toEqual({ 'analitica-1': 1000, 'analitica-2': 250 });
  });

  it('GOLDEN — fixture rica: Viagem + Item + Empregado (overlap) + Rateio, mapa bruto completo', async () => {
    const prisma = criarPrismaMock({
      propostaPeriodo: { dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-12-31') },
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
      itens: [
        { contaId: 'c-bens', valorTotal: 45000 },
        { contaId: 'c-passagem', valorTotal: 1000 }, // colide com Viagem de propósito
      ],
      empregados: [
        // overlap jan-dez = 12 meses
        { contaId: 'c-pessoal', periodoInicio: new Date('2026-01-01'), periodoFim: null, valorSalarioSnapshot: 5000 },
        // overlap jul-dez = 6 meses
        { contaId: 'c-pessoal', periodoInicio: new Date('2026-07-01'), periodoFim: null, valorSalarioSnapshot: 3000 },
      ],
      rateiosImposto: [{ contaId: 'c-pessoal', valorDeclarado: 8500 }],
    });

    const mapa = await new ValorRealizadoService(prisma as never).somarPorContaAnalitica('t1', 'v1');

    expect(objeto(mapa)).toEqual({
      'c-passagem': 800 * 3 + 1000, // 3400
      'c-diaria': 250 * 3 * 4, // 3000
      'c-transporte': 120 * 3, // 360
      'c-bens': 45000,
      'c-pessoal': 5000 * 12 + 3000 * 6 + 8500, // 60000 + 18000 + 8500 = 86500
    });
  });
});
