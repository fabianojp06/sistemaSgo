import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calcularPlanoReajusteConta, gerarCompetencias } from './calcularReajusteLote';

const d = (v: number) => new Prisma.Decimal(v);
const m = (ano: number, mes: number) => new Date(Date.UTC(ano, mes - 1, 1));

describe('gerarCompetencias', () => {
  it('gera 1 data por mês, inclusive nas pontas', () => {
    const meses = gerarCompetencias(m(2026, 1), m(2026, 3));
    expect(meses).toEqual([m(2026, 1), m(2026, 2), m(2026, 3)]);
  });

  it('1 único mês quando início e fim coincidem', () => {
    expect(gerarCompetencias(m(2026, 6), m(2026, 6))).toEqual([m(2026, 6)]);
  });
});

describe('calcularPlanoReajusteConta [US-129/ADR-040]', () => {
  it('Cenário 10 — mês futuro sem linha anterior gera linha nova com base 0 e o novo percentual', () => {
    const plano = calcularPlanoReajusteConta({
      contaId: 'c1',
      linhasExistentes: [],
      aliquotaNova: d(5.5),
      competencias: [m(2026, 12)],
      competenciaCorrente: m(2026, 8),
      periodicidadeMeses: 1,
      ancoraVigencia: m(2026, 1),
    });

    expect(plano.linhasFuturas).toEqual([
      { competencia: m(2026, 12), valorAnterior: null, valorNovo: d(0), aliquotaAnterior: null, aliquotaNova: d(5.5) },
    ]);
    expect(plano.ajusteRetroativo).toBeNull();
  });

  it('Cenário 10 — mês futuro cresce pelo índice a partir da base (própria linha, ou a última conhecida)', () => {
    const plano = calcularPlanoReajusteConta({
      contaId: 'c1',
      linhasExistentes: [{ competencia: m(2026, 6), valorDeclarado: d(1000), aliquotaAplicadaSnapshot: d(4) }],
      aliquotaNova: d(6),
      competencias: [m(2026, 6), m(2026, 12)],
      competenciaCorrente: m(2026, 3),
      periodicidadeMeses: 1,
      ancoraVigencia: m(2026, 1),
    });

    expect(plano.linhasFuturas).toHaveLength(2);
    // jun/2026 já tinha linha (base 1000) — cresce 6%: 1000 * 1.06 = 1060.
    expect(plano.linhasFuturas[0].valorAnterior?.toString()).toBe('1000');
    expect(plano.linhasFuturas[0].valorNovo.toString()).toBe('1060');
    // dez/2026 não tinha linha própria — com periodicidade MENSAL, cada mês é um ciclo de
    // aplicação novo, então cresce em cima do valor JÁ CRESCIDO de jun (composto): 1060*1.06=1123.60.
    expect(plano.linhasFuturas[1].valorAnterior).toBeNull();
    expect(plano.linhasFuturas[1].valorNovo.toString()).toBe('1123.6');

    // dez/2026 não tinha base própria configurada — não conta como "dinheiro novo" no
    // orçado (só preenche a projeção). Só jun/2026 contribui: 1060-1000 = 60.
    expect(plano.deltasValorOrcadoPorExercicio).toHaveLength(1);
    expect(plano.deltasValorOrcadoPorExercicio[0].exercicio).toBe(2026);
    expect(plano.deltasValorOrcadoPorExercicio[0].delta.toString()).toBe('60');
  });

  it('periodicidade ANUAL — só cresce no mês âncora, fica estável (flat) nos outros meses do ciclo', () => {
    const plano = calcularPlanoReajusteConta({
      contaId: 'c1',
      linhasExistentes: [{ competencia: m(2026, 9), valorDeclarado: d(1000), aliquotaAplicadaSnapshot: d(0) }],
      aliquotaNova: d(5),
      competencias: [m(2026, 9), m(2026, 10), m(2026, 11), m(2027, 9)],
      competenciaCorrente: m(2026, 8),
      periodicidadeMeses: 12,
      ancoraVigencia: m(2026, 9),
    });

    // set/2026 é o mês âncora — cresce: 1000 * 1.05 = 1050.
    expect(plano.linhasFuturas[0].valorNovo.toString()).toBe('1050');
    // out e nov/2026 — fora do ciclo, ficam estáveis no valor já crescido (flat, sem crescer de novo).
    expect(plano.linhasFuturas[1].valorNovo.toString()).toBe('1050');
    expect(plano.linhasFuturas[2].valorNovo.toString()).toBe('1050');
    // set/2027 — 12 meses depois do âncora, novo ciclo: cresce de novo (composto): 1050*1.05=1102.5.
    expect(plano.linhasFuturas[3].valorNovo.toString()).toBe('1102.5');
  });

  it('periodicidade TRIMESTRAL — cresce só nos meses alinhados a cada 3 a partir da âncora, composto entre ciclos', () => {
    const plano = calcularPlanoReajusteConta({
      contaId: 'c1',
      linhasExistentes: [{ competencia: m(2026, 1), valorDeclarado: d(1000), aliquotaAplicadaSnapshot: d(0) }],
      aliquotaNova: d(10),
      competencias: [m(2026, 1), m(2026, 2), m(2026, 3), m(2026, 4)],
      competenciaCorrente: m(2025, 12),
      periodicidadeMeses: 3,
      ancoraVigencia: m(2026, 1),
    });

    // jan/2026 (diff=0, alinhado) — cresce: 1000 * 1.10 = 1100.
    expect(plano.linhasFuturas[0].valorNovo.toString()).toBe('1100');
    // fev e mar/2026 (diff=1,2, fora do ciclo) — ficam estáveis no valor já crescido.
    expect(plano.linhasFuturas[1].valorNovo.toString()).toBe('1100');
    expect(plano.linhasFuturas[2].valorNovo.toString()).toBe('1100');
    // abr/2026 (diff=3, novo ciclo) — cresce de novo, composto: 1100 * 1.10 = 1210.
    expect(plano.linhasFuturas[3].valorNovo.toString()).toBe('1210');
  });

  it('Cenário 11/ADR-040 — mês passado nunca vira linha própria, só contribui para o ajuste retroativo', () => {
    const plano = calcularPlanoReajusteConta({
      contaId: 'c1',
      linhasExistentes: [{ competencia: m(2026, 1), valorDeclarado: d(1000), aliquotaAplicadaSnapshot: d(4) }],
      aliquotaNova: d(6),
      competencias: [m(2026, 1)],
      competenciaCorrente: m(2026, 8),
      periodicidadeMeses: 1,
      ancoraVigencia: m(2026, 1),
    });

    expect(plano.linhasFuturas).toEqual([]);
    // delta = 1000 * (6 - 4) / 100 = 20
    expect(plano.ajusteRetroativo).toMatchObject({
      competenciaAjuste: m(2026, 8),
      valorBaseExistente: null,
      valorAjuste: d(20),
      valorFinal: d(20),
      mesesAfetados: ['2026-01'],
    });
  });

  it('ADR-040 — mês passado sem linha existente não gera ajuste (nada a reajustar)', () => {
    const plano = calcularPlanoReajusteConta({
      contaId: 'c1',
      linhasExistentes: [],
      aliquotaNova: d(6),
      competencias: [m(2026, 1), m(2026, 2)],
      competenciaCorrente: m(2026, 8),
      periodicidadeMeses: 1,
      ancoraVigencia: m(2026, 1),
    });

    expect(plano.linhasFuturas).toEqual([]);
    expect(plano.ajusteRetroativo).toBeNull();
  });

  it('ADR-040 — soma deltas de múltiplos meses retroativos em 1 única linha no mês atual', () => {
    const plano = calcularPlanoReajusteConta({
      contaId: 'c1',
      linhasExistentes: [
        { competencia: m(2026, 1), valorDeclarado: d(1000), aliquotaAplicadaSnapshot: d(4) },
        { competencia: m(2026, 2), valorDeclarado: d(2000), aliquotaAplicadaSnapshot: d(4) },
      ],
      aliquotaNova: d(5),
      competencias: [m(2026, 1), m(2026, 2)],
      competenciaCorrente: m(2026, 8),
      periodicidadeMeses: 1,
      ancoraVigencia: m(2026, 1),
    });

    // deltas: 1000*(5-4)/100=10 ; 2000*(5-4)/100=20 → soma 30
    expect(plano.ajusteRetroativo?.valorAjuste.toString()).toBe('30');
    expect(plano.ajusteRetroativo?.mesesAfetados).toEqual(['2026-01', '2026-02']);
  });

  it('soma ao valor já existente no mês atual (upsert), em vez de sobrescrever', () => {
    const plano = calcularPlanoReajusteConta({
      contaId: 'c1',
      linhasExistentes: [
        { competencia: m(2026, 1), valorDeclarado: d(1000), aliquotaAplicadaSnapshot: d(4) },
        { competencia: m(2026, 8), valorDeclarado: d(500), aliquotaAplicadaSnapshot: d(4) },
      ],
      aliquotaNova: d(5),
      competencias: [m(2026, 1)],
      competenciaCorrente: m(2026, 8),
      periodicidadeMeses: 1,
      ancoraVigencia: m(2026, 1),
    });

    expect(plano.ajusteRetroativo).toMatchObject({ valorBaseExistente: d(500), valorAjuste: d(10), valorFinal: d(510) });
  });

  it('arredonda o delta com Half-Even, 2 casas decimais [RN_PR_006]', () => {
    const plano = calcularPlanoReajusteConta({
      contaId: 'c1',
      linhasExistentes: [{ competencia: m(2026, 1), valorDeclarado: d(333.335), aliquotaAplicadaSnapshot: d(0) }],
      aliquotaNova: d(1),
      competencias: [m(2026, 1)],
      competenciaCorrente: m(2026, 8),
      periodicidadeMeses: 1,
      ancoraVigencia: m(2026, 1),
    });

    // 333.335 * 1 / 100 = 3.33335 → Half-Even em 2 casas = 3.33
    expect(plano.ajusteRetroativo?.valorAjuste.toString()).toBe('3.33');
  });

  it('[ultrareview 2026-08-11] idempotência — linha futura já na taxa nova não cresce de novo (fica flat)', () => {
    const plano = calcularPlanoReajusteConta({
      contaId: 'c1',
      // Simula o resultado JÁ persistido de uma 1ª aplicação: valor crescido e
      // snapshot já na taxa nova (6%).
      linhasExistentes: [{ competencia: m(2026, 9), valorDeclarado: d(1060), aliquotaAplicadaSnapshot: d(6) }],
      aliquotaNova: d(6),
      competencias: [m(2026, 9)],
      competenciaCorrente: m(2026, 8),
      periodicidadeMeses: 1,
      ancoraVigencia: m(2026, 9),
    });

    expect(plano.linhasFuturas[0].valorNovo.toString()).toBe('1060');
    expect(plano.deltasValorOrcadoPorExercicio).toEqual([]);
  });

  it('[ultrareview 2026-08-11] idempotência — ajuste retroativo não soma de novo se a linha do mês atual já está na taxa nova', () => {
    const plano = calcularPlanoReajusteConta({
      contaId: 'c1',
      linhasExistentes: [
        { competencia: m(2026, 1), valorDeclarado: d(1000), aliquotaAplicadaSnapshot: d(4) },
        // Linha do mês atual já reflete o resultado de uma 1ª aplicação (snapshot == aliquotaNova).
        { competencia: m(2026, 8), valorDeclarado: d(1020), aliquotaAplicadaSnapshot: d(6) },
      ],
      aliquotaNova: d(6),
      competencias: [m(2026, 1)],
      competenciaCorrente: m(2026, 8),
      periodicidadeMeses: 1,
      ancoraVigencia: m(2026, 1),
    });

    expect(plano.ajusteRetroativo).toBeNull();
  });
});
