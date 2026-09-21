/**
 * ANEXO 6 — COMPOSIÇÃO DOS CUSTOS DE REMUNERAÇÃO E BENEFÍCIOS (EMPREGADOS).
 *
 * Catálogo FIXO das rubricas e percentuais do anexo, no padrão IN 05/2017.
 * Decisão do usuário (2026-09-21): os percentuais dos Módulos 2, 3, 4 e 5 são
 * constantes de domínio — não são parametrizáveis por Proposta nem cadastrados
 * por tenant. Trocar qualquer valor aqui muda o relatório inteiro e QUEBRA os
 * testes de `montarAnexo6.test.ts`, que travam os números do anexo de
 * referência (Termo de Parceria PAME-RJ/CTCEA/2025, Rev.01) — isso é
 * intencional: um percentual estatutário só muda por decisão de negócio
 * explícita, nunca por descuido.
 *
 * Se um dia esses percentuais precisarem variar por Proposta (ex.: ISS de outro
 * município), a migração é trocar este módulo por uma fonte parametrizada; a
 * assinatura de `montarAnexo6` já recebe os percentuais por injeção justamente
 * para que essa troca não vire refatoração de tudo.
 */
export type RubricaFixa = {
  codigo: string;
  rotulo: string;
  /** Percentual sobre a Base de Encargos. `null` imprime "-" no anexo. */
  percentual: string | null;
};

/** Módulo 1 — Composição da Remuneração. */
export const RUBRICAS_MODULO_1 = {
  salarioBase: { codigo: 'A', rotulo: 'Salário-Base*', percentual: '100.00' },
  periculosidade: { codigo: 'B', rotulo: 'Adicional de Periculosidade', percentual: null },
  insalubridade: { codigo: 'C', rotulo: 'Adicional de Insalubridade', percentual: null },
  adicionalNoturno: { codigo: 'D', rotulo: 'Adicional Noturno', percentual: null },
  horaNoturnaReduzida: { codigo: 'E', rotulo: 'Adicional de Hora Noturna Reduzida', percentual: null },
  horaExtra: { codigo: 'F', rotulo: 'Adicional de Hora Extra', percentual: null },
  // O anexo de referência rotula G como "Outros (Adicional de hora extra)" — o
  // parêntese é só o exemplo preenchido por quem montou a planilha. Aqui G
  // carrega a Função Gratificada do Cargo, que é o único "outro" de remuneração
  // que o SGO modela hoje; o rótulo diz a verdade sobre o conteúdo.
  outros: { codigo: 'G', rotulo: 'Outros (Função Gratificada)', percentual: null },
} as const satisfies Record<string, RubricaFixa>;

/** Submódulo 2.1 — 13º Salário, Férias e Adicional de Férias. */
export const RUBRICAS_SUBMODULO_2_1 = {
  decimoTerceiro: { codigo: 'A', rotulo: '13º (décimo terceiro) Salário', percentual: '8.33' },
  ferias: { codigo: 'B', rotulo: 'Férias e Adicional de Férias', percentual: '5.56' },
} as const satisfies Record<string, RubricaFixa>;

/** Submódulo 2.2 — GPS, FGTS e outras contribuições (soma 33,50%). */
export const RUBRICAS_SUBMODULO_2_2 = {
  inss: { codigo: 'A', rotulo: 'INSS', percentual: '20.00' },
  salarioEducacao: { codigo: 'B', rotulo: 'Salário Educação', percentual: '2.50' },
  sat: { codigo: 'C', rotulo: 'SAT- GIL/RAT', percentual: '1.00' },
  sescSesi: { codigo: 'D', rotulo: 'SESC ou SESI', percentual: '1.50' },
  senaiSenac: { codigo: 'E', rotulo: 'SENAI - SENAC', percentual: '0.00' },
  sebrae: { codigo: 'F', rotulo: 'SEBRAE', percentual: '0.30' },
  incra: { codigo: 'G', rotulo: 'INCRA', percentual: '0.20' },
  fgts: { codigo: 'H', rotulo: 'FGTS', percentual: '8.00' },
} as const satisfies Record<string, RubricaFixa>;

/** Submódulo 2.3 — Benefícios Mensais e Diários (valores vêm do Cargo, não de %). */
export const RUBRICAS_SUBMODULO_2_3 = {
  transporte: { codigo: 'A', rotulo: 'Transporte', percentual: null },
  alimentacao: { codigo: 'B', rotulo: 'Auxílio-Refeição/Alimentação', percentual: null },
  assistencia: {
    codigo: 'C',
    rotulo: 'Assistência médica e familiar (saúde e odontológico) / Seguro de vida, invalidez e funeral',
    percentual: null,
  },
  outros: { codigo: 'D', rotulo: 'Outros (Auxílio-Creche)', percentual: null },
} as const satisfies Record<string, RubricaFixa>;

/**
 * Módulo 3 — Provisão para Rescisão. A..E ficam zeradas (o SGO não modela aviso
 * prévio); só F tem percentual, igual ao anexo de referência.
 */
export const RUBRICAS_MODULO_3 = {
  avisoPrevioIndenizado: { codigo: 'A', rotulo: 'Aviso Prévio Indenizado', percentual: null },
  fgtsSobreAvisoIndenizado: { codigo: 'B', rotulo: 'Incidência do FGTS sobre o Aviso Prévio Indenizado', percentual: null },
  multaFgtsAvisoIndenizado: {
    codigo: 'C',
    rotulo: 'Multa do FGTS e contribuição social sobre o Aviso Prévio Indenizado',
    percentual: null,
  },
  avisoPrevioTrabalhado: { codigo: 'D', rotulo: 'Aviso Prévio Trabalhado', percentual: null },
  encargos22SobreAvisoTrabalhado: {
    codigo: 'E',
    rotulo: 'Incidência dos encargos do submódulo 2.2 sobre o Aviso Prévio Trabalhado',
    percentual: null,
  },
  multaFgtsAvisoTrabalhado: {
    codigo: 'F',
    rotulo: 'Multa do FGTS e contribuição social sobre o Aviso Prévio Trabalhado / Provisão Risco Trabalhista',
    percentual: '3.00',
  },
} as const satisfies Record<string, RubricaFixa>;

/** Submódulo 4.1 — Ausências Legais (todas zeradas: sem modelagem no SGO). */
export const RUBRICAS_SUBMODULO_4_1: RubricaFixa[] = [
  { codigo: 'A', rotulo: 'Férias', percentual: null },
  { codigo: 'B', rotulo: 'Ausências Legais', percentual: null },
  { codigo: 'C', rotulo: 'Licença-Paternidade', percentual: null },
  { codigo: 'D', rotulo: 'Ausência por acidente de trabalho', percentual: null },
  { codigo: 'E', rotulo: 'Afastamento Maternidade', percentual: null },
  { codigo: 'F', rotulo: 'Outros (especificar)', percentual: null },
];

/** Submódulo 4.2 — Intrajornada (zerada). */
export const RUBRICAS_SUBMODULO_4_2: RubricaFixa[] = [
  { codigo: 'A', rotulo: 'Intervalo para repouso e alimentação', percentual: null },
];

/** Módulo 5 — Insumos Diversos (zerado: o SGO não modela insumo por empregado). */
export const RUBRICAS_MODULO_5: RubricaFixa[] = [
  { codigo: 'A', rotulo: 'Uniformes', percentual: null },
  { codigo: 'B', rotulo: 'Materiais', percentual: null },
  { codigo: 'C', rotulo: 'Equipamentos', percentual: null },
  { codigo: 'D', rotulo: 'Outros (especificar)', percentual: null },
];

/** Módulo 6 — Custos Indiretos, Tributos e Lucro. */
export const RUBRICAS_MODULO_6 = {
  custosIndiretos: { codigo: 'A', rotulo: 'Custos Indiretos', percentual: null },
  lucro: { codigo: 'B', rotulo: 'Lucro', percentual: null },
  pis: { codigo: 'C.1.', rotulo: 'Tributos Federais (PIS)', percentual: '1.00' },
  tributosEstaduais: { codigo: 'C.2.', rotulo: 'Tributos Estaduais (especificar)', percentual: null },
  iss: { codigo: 'C.3.', rotulo: 'Tributos Municipais (ISS)', percentual: '5.00' },
} as const satisfies Record<string, RubricaFixa>;

/** Percentuais aplicados pelo cálculo, agrupados para injeção em `montarAnexo6`. */
export const PERCENTUAIS_ANEXO6 = {
  decimoTerceiro: RUBRICAS_SUBMODULO_2_1.decimoTerceiro.percentual,
  ferias: RUBRICAS_SUBMODULO_2_1.ferias.percentual,
  inss: RUBRICAS_SUBMODULO_2_2.inss.percentual,
  salarioEducacao: RUBRICAS_SUBMODULO_2_2.salarioEducacao.percentual,
  sat: RUBRICAS_SUBMODULO_2_2.sat.percentual,
  sescSesi: RUBRICAS_SUBMODULO_2_2.sescSesi.percentual,
  senaiSenac: RUBRICAS_SUBMODULO_2_2.senaiSenac.percentual,
  sebrae: RUBRICAS_SUBMODULO_2_2.sebrae.percentual,
  incra: RUBRICAS_SUBMODULO_2_2.incra.percentual,
  fgts: RUBRICAS_SUBMODULO_2_2.fgts.percentual,
  provisaoRescisao: RUBRICAS_MODULO_3.multaFgtsAvisoTrabalhado.percentual,
  pis: RUBRICAS_MODULO_6.pis.percentual,
  iss: RUBRICAS_MODULO_6.iss.percentual,
} as const;

export type PercentuaisAnexo6 = typeof PERCENTUAIS_ANEXO6;
