import type { GradeSalarialCtceaPayload, GradeSalarialCtceaProvider } from './types';
import { GRADE_SALARIAL_CTCEA_RAW } from './grade-salarial-ctcea-raw';

/**
 * Fonte da Grade Salarial CTCEA (relatório real Faixa x Nível -> Salário),
 * embutida como constante em grade-salarial-ctcea-raw.ts — mesmo padrão de
 * PlanoContasArquivoProvider (ADR-046/US-137). `cargoMercado`/`cargoCtcea`
 * nascem nulos: o relatório fonte não tem nomes de cargo, só a grade numérica.
 */
export class GradeSalarialCtceaArquivoProvider implements GradeSalarialCtceaProvider {
  async buscarGradeAtiva(): Promise<GradeSalarialCtceaPayload[]> {
    return GRADE_SALARIAL_CTCEA_RAW.map((linha) => ({
      faixa: linha.faixa,
      nivel: linha.nivel,
      salario: linha.salario,
    }));
  }
}
