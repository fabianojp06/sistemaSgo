import { Prisma } from '@prisma/client';

/**
 * US-129/UC04.02 [ADR-040, revisado 2026-08-11] — motor de cálculo do reajuste em
 * lote, puro (sem I/O), compartilhado entre SimularReajusteUseCase (preview) e
 * AplicarReajusteUseCase (persistência), para garantir que o preview mostrado ao
 * usuário seja exatamente o que é gravado ao confirmar.
 *
 * Regras aplicadas (RN_PR_001/002/006):
 * - Mês <= mês corrente é "Realizado"/passado — nunca gera/edita linha própria em
 *   RateioImpostoGrade. Se havia uma linha existente desse (parâmetro, conta) nesse
 *   mês, contribui para o ajuste retroativo: delta = valorDeclarado ×
 *   (aliquotaNova − aliquotaAnterior) / 100.
 * - Mês > mês corrente é "futuro" — gera/atualiza 1 linha por competência.
 *   [Revisão 2026-08-11] O valor deixou de ser só carregado adiante sem mudar:
 *   agora CRESCE pelo índice (valorNovo = base × (1 + aliquotaNova/100)) — sem
 *   isso, "aplicar reajuste" não tinha efeito monetário nenhum, só trocava o
 *   percentual snapshot. Cada mês futuro cresce a partir da SUA PRÓPRIA base
 *   (valor já existente naquele mês, ou o último valor conhecido antes do range),
 *   nunca a partir do valor já crescido do mês anterior — evita compounding
 *   acidental dentro de uma mesma aplicação.
 * - Todo o ajuste retroativo acumulado (soma dos deltas) vira 1 única linha nova
 *   em RateioImpostoGrade, datada no mês corrente — nunca sobrescreve uma linha
 *   passada (ADR-040).
 * - [Revisão 2026-08-11] O efeito monetário (RateioImpostoGrade) por si só não
 *   movia o Valor Orçado da conta — gap encontrado em teste manual. Agora o plano
 *   também soma, por exercício (ano civil), o delta total a incrementar em
 *   ValorOrcadoConta (soma dos crescimentos futuros do ano + o ajuste retroativo,
 *   se caiu nesse ano).
 */

export type LinhaGradeExistente = {
  competencia: Date;
  valorDeclarado: Prisma.Decimal;
  aliquotaAplicadaSnapshot: Prisma.Decimal;
};

export type LinhaReajusteFutura = {
  competencia: Date;
  valorAnterior: Prisma.Decimal | null;
  valorNovo: Prisma.Decimal;
  aliquotaAnterior: Prisma.Decimal | null;
  aliquotaNova: Prisma.Decimal;
};

export type AjusteRetroativo = {
  competenciaAjuste: Date;
  valorBaseExistente: Prisma.Decimal | null;
  valorAjuste: Prisma.Decimal;
  valorFinal: Prisma.Decimal;
  mesesAfetados: string[];
};

export type DeltaValorOrcadoExercicio = { exercicio: number; delta: Prisma.Decimal };

export type PlanoReajusteConta = {
  contaId: string;
  linhasFuturas: LinhaReajusteFutura[];
  ajusteRetroativo: AjusteRetroativo | null;
  deltasValorOrcadoPorExercicio: DeltaValorOrcadoExercicio[];
};

function arredondar(valor: Prisma.Decimal): Prisma.Decimal {
  return valor.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);
}

export function calcularPlanoReajusteConta(params: {
  contaId: string;
  linhasExistentes: LinhaGradeExistente[];
  aliquotaNova: Prisma.Decimal;
  competencias: Date[];
  competenciaCorrente: Date;
  /** Meses entre uma reaplicação do % e a próxima (1/3/6/12 — MENSAL/TRIMESTRAL/SEMESTRAL/ANUAL). */
  periodicidadeMeses: number;
  /** Âncora do ciclo — normalmente dataInicioVigencia do índice. */
  ancoraVigencia: Date;
}): PlanoReajusteConta {
  const porCompetencia = new Map(params.linhasExistentes.map((l) => [l.competencia.getTime(), l]));

  const antesDoRange = params.linhasExistentes.filter(
    (l) => params.competencias.length === 0 || l.competencia.getTime() < params.competencias[0].getTime(),
  );
  let baseCarregada = antesDoRange.length > 0 ? antesDoRange[antesDoRange.length - 1].valorDeclarado : new Prisma.Decimal(0);

  const mesIndiceAncora = params.ancoraVigencia.getUTCFullYear() * 12 + params.ancoraVigencia.getUTCMonth();
  function ehMesDeAplicacao(competencia: Date): boolean {
    const mesIndice = competencia.getUTCFullYear() * 12 + competencia.getUTCMonth();
    const diferenca = mesIndice - mesIndiceAncora;
    return diferenca >= 0 && diferenca % params.periodicidadeMeses === 0;
  }

  const linhasFuturas: LinhaReajusteFutura[] = [];
  const deltaPorExercicio = new Map<number, Prisma.Decimal>();
  let deltaTotal = new Prisma.Decimal(0);
  const mesesAfetados: string[] = [];

  function somarDeltaExercicio(ano: number, valor: Prisma.Decimal) {
    deltaPorExercicio.set(ano, (deltaPorExercicio.get(ano) ?? new Prisma.Decimal(0)).plus(valor));
  }

  // [ultrareview 2026-08-11] Idempotência — reabrir o modal e confirmar de novo o
  // MESMO reajuste não pode duplicar valor. Como o ajuste retroativo (ADR-040)
  // nunca atualiza o snapshot das linhas passadas, o único jeito de saber "esse
  // índice já foi aplicado nesta taxa" é checar a PRÓPRIA linha de ajuste no mês
  // atual: se o snapshot dela já é a taxa nova, o catch-up já rodou — não soma de
  // novo.
  const linhaAjusteAtual = porCompetencia.get(params.competenciaCorrente.getTime()) ?? null;
  const reajusteRetroativoJaAplicado = linhaAjusteAtual !== null && linhaAjusteAtual.aliquotaAplicadaSnapshot.equals(params.aliquotaNova);

  for (const competencia of params.competencias) {
    const existente = porCompetencia.get(competencia.getTime()) ?? null;
    const ehPassado = competencia.getTime() <= params.competenciaCorrente.getTime();

    if (ehPassado) {
      if (existente && !reajusteRetroativoJaAplicado) {
        const delta = arredondar(existente.valorDeclarado.times(params.aliquotaNova.minus(existente.aliquotaAplicadaSnapshot)).dividedBy(100));
        deltaTotal = deltaTotal.plus(delta);
        mesesAfetados.push(competencia.toISOString().slice(0, 7));
        baseCarregada = existente.valorDeclarado;
      }
      continue;
    }

    // Idempotência (mesma razão do bloco acima) — se esta linha futura específica
    // já está na taxa nova, não cresce de novo; fica flat no valor já aplicado.
    const jaAplicadoNestaLinha = existente !== null && existente.aliquotaAplicadaSnapshot.equals(params.aliquotaNova);
    const valorBase = existente ? existente.valorDeclarado : baseCarregada;
    // Só cresce nos meses alinhados ao ciclo da periodicidade (RN nova, 2026-08-11) —
    // entre uma aplicação e a próxima, o valor fica estável (flat), sem crescer de novo.
    const valorNovo =
      ehMesDeAplicacao(competencia) && !jaAplicadoNestaLinha
        ? arredondar(valorBase.times(params.aliquotaNova.dividedBy(100).plus(1)))
        : arredondar(valorBase);
    linhasFuturas.push({
      competencia,
      valorAnterior: existente?.valorDeclarado ?? null,
      valorNovo,
      aliquotaAnterior: existente?.aliquotaAplicadaSnapshot ?? null,
      aliquotaNova: params.aliquotaNova,
    });
    // Só soma no Valor Orçado quando o mês JÁ tinha uma base própria configurada
    // (existente !== null). Meses sem linha própria são preenchidos aqui só para
    // o relatório/projeção (mesmo espírito de ListarPremissasReajusteUseCase) —
    // contar o valor cheio deles como "dinheiro novo" infla o orçado a cada mês
    // vazio, multiplicando o efeito por engano.
    if (existente) {
      somarDeltaExercicio(competencia.getUTCFullYear(), valorNovo.minus(existente.valorDeclarado));
    }
    // Carrega o valor JÁ CRESCIDO (não o pré-crescimento) — é o que permite o
    // composto correto entre um ciclo de periodicidade e o próximo.
    baseCarregada = valorNovo;
  }

  const linhaNaCompetenciaAjuste = porCompetencia.get(params.competenciaCorrente.getTime()) ?? null;
  const ajusteRetroativo: AjusteRetroativo | null = deltaTotal.isZero()
    ? null
    : {
        competenciaAjuste: params.competenciaCorrente,
        valorBaseExistente: linhaNaCompetenciaAjuste?.valorDeclarado ?? null,
        valorAjuste: deltaTotal,
        valorFinal: arredondar((linhaNaCompetenciaAjuste?.valorDeclarado ?? new Prisma.Decimal(0)).plus(deltaTotal)),
        mesesAfetados,
      };
  if (ajusteRetroativo) {
    somarDeltaExercicio(ajusteRetroativo.competenciaAjuste.getUTCFullYear(), ajusteRetroativo.valorAjuste);
  }

  return {
    contaId: params.contaId,
    linhasFuturas,
    ajusteRetroativo,
    deltasValorOrcadoPorExercicio: [...deltaPorExercicio.entries()]
      .filter(([, delta]) => !delta.isZero())
      .map(([exercicio, delta]) => ({ exercicio, delta })),
  };
}

/** Todo mês (1º dia, UTC) entre `inicio` e `fim`, inclusive. */
export function gerarCompetencias(inicio: Date, fim: Date): Date[] {
  const meses: Date[] = [];
  let cursor = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1));
  const limite = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), 1));
  while (cursor.getTime() <= limite.getTime()) {
    meses.push(cursor);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return meses;
}
