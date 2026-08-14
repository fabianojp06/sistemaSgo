/** ADR-046 (US-137) — payload de uma linha da Grade Salarial CTCEA vinda da fonte externa. */
export type GradeSalarialCtceaPayload = {
  faixa: string;
  nivel: string;
  salario: number;
};

export interface GradeSalarialCtceaProvider {
  buscarGradeAtiva(): Promise<GradeSalarialCtceaPayload[]>;
}
