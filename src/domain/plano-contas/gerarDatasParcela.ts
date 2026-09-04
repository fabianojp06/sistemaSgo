/**
 * US-142 / ADR-049 §D — gera as datas e a numeração de Etapa das parcelas do
 * Cronograma de Desembolso (layout ANEXO 9), a partir do calendário de repasse
 * configurado na Proposta.
 *
 * [ORIGEM BLINDADA] — função pura, sem I/O. É a única fonte da matemática de
 * datas/Etapas; `agregarEmParcelas` a consome.
 *
 * Regras (ADR-049 §D):
 * - `espacamento = 12 / parcelasPorAno` (parcelasPorAno ∈ {1,2,3,4,6,12}).
 * - Datas regulares: a partir de `mesInicialRepasse`, de `espacamento` em
 *   `espacamento` meses, mantendo só as que caem em [mês de dataInicio, mês de dataFim].
 * - Parcela de entrada: sempre o mês de `dataInicio`.
 * - Se a entrada coincide com uma data regular → FUSÃO: existe 1 linha T1 que
 *   representa "Etapas 1 e 2"; as demais Tn (n≥2) recebem Etapa = n + 1.
 * - Sem fusão: T1 = só a entrada (Etapa 1); Tn = Etapa n.
 * - Proposta curta (nenhuma data regular na vigência) → só T1.
 */

export type ConfigCalendarioRepasse = {
  dataInicio: Date;
  dataFim: Date;
  parcelasPorAno: number; // ∈ {1, 2, 3, 4, 6, 12}
  mesInicialRepasse: number; // 1..12
};

export type ParcelaDatada = {
  /** 1..n, na ordem cronológica. */
  numero: number;
  /** Primeiro dia do mês da parcela (UTC). */
  data: Date;
  /** Texto da coluna "Descrição do Evento" do ANEXO 9. */
  descricao: string;
};

export const PARCELAS_POR_ANO_VALIDAS: readonly number[] = [1, 2, 3, 4, 6, 12];

function primeiroDiaDoMes(ano: number, mesIndex0: number): Date {
  return new Date(Date.UTC(ano, mesIndex0, 1));
}

function primeiroDiaDoMesDe(data: Date): Date {
  return primeiroDiaDoMes(data.getUTCFullYear(), data.getUTCMonth());
}

function addMeses(data: Date, n: number): Date {
  return primeiroDiaDoMes(data.getUTCFullYear(), data.getUTCMonth() + n);
}

export function gerarDatasParcela(config: ConfigCalendarioRepasse): ParcelaDatada[] {
  const { dataInicio, dataFim, parcelasPorAno, mesInicialRepasse } = config;

  if (!PARCELAS_POR_ANO_VALIDAS.includes(parcelasPorAno)) {
    throw new Error(`parcelasPorAno inválido: ${parcelasPorAno} (esperado 1, 2, 3, 4, 6 ou 12).`);
  }
  if (!Number.isInteger(mesInicialRepasse) || mesInicialRepasse < 1 || mesInicialRepasse > 12) {
    throw new Error(`mesInicialRepasse inválido: ${mesInicialRepasse} (esperado 1 a 12).`);
  }

  const espacamento = 12 / parcelasPorAno;
  const inicioMes = primeiroDiaDoMesDe(dataInicio);
  const fimMes = primeiroDiaDoMesDe(dataFim);

  // Datas regulares — começa 1 ano antes do início (garante pegar o 1º ciclo) e avança.
  const regulares: Date[] = [];
  let cursor = primeiroDiaDoMes(dataInicio.getUTCFullYear() - 1, mesInicialRepasse - 1);
  while (cursor.getTime() <= fimMes.getTime()) {
    if (cursor.getTime() >= inicioMes.getTime()) {
      regulares.push(cursor);
    }
    cursor = addMeses(cursor, espacamento);
  }

  const inicioEhRegular = regulares.some((d) => d.getTime() === inicioMes.getTime());

  const datas: Date[] = inicioEhRegular
    ? [inicioMes, ...regulares.filter((d) => d.getTime() !== inicioMes.getTime())]
    : [inicioMes, ...regulares];
  datas.sort((a, b) => a.getTime() - b.getTime());

  return datas.map((data, indice) => {
    const numero = indice + 1;
    let descricao: string;
    if (numero === 1 && inicioEhRegular) {
      descricao = '1ª parcela relativa às Etapas 1 e 2 do Cronograma Físico';
    } else {
      const etapa = inicioEhRegular ? numero + 1 : numero;
      descricao = `${numero}ª parcela relativa à Etapa ${etapa} do Cronograma Físico`;
    }
    return { numero, data, descricao };
  });
}
