import { Prisma } from '@prisma/client';
import { calcularBreakdownComponenteCusto, type BeneficiosCargo } from '../plano-contas/calcularCustoTotalCargo';
import {
  PERCENTUAIS_ANEXO6,
  RUBRICAS_MODULO_1,
  RUBRICAS_MODULO_3,
  RUBRICAS_MODULO_5,
  RUBRICAS_MODULO_6,
  RUBRICAS_SUBMODULO_2_1,
  RUBRICAS_SUBMODULO_2_2,
  RUBRICAS_SUBMODULO_2_3,
  RUBRICAS_SUBMODULO_4_1,
  RUBRICAS_SUBMODULO_4_2,
  type PercentuaisAnexo6,
  type RubricaFixa,
} from './percentuaisAnexo6';

export type CargoParaAnexo6 = BeneficiosCargo & {
  id: string;
  nomeCargoMercado: string;
  funcaoGratificada: Prisma.Decimal.Value | null;
  salarioTotal: Prisma.Decimal.Value;
  /** COUNT de EmpregadoHeadcount ativos do Cargo. Zero é válido: o Cargo entra
   *  no anexo com a coluna preenchida mesmo sem empregado vinculado (decisão do
   *  usuário 2026-09-21) — o valor por empregado independe do headcount. */
  quantidadeEmpregados: number;
};

export type NivelLinhaAnexo6 = 'rubrica' | 'subtotal' | 'total';

export type LinhaAnexo6 = {
  codigo: string;
  rotulo: string;
  /** Percentual impresso na coluna "Percentual (%)". `null` imprime "-". */
  percentual: Prisma.Decimal | null;
  nivel: NivelLinhaAnexo6;
  /** Uma posição por Cargo, na mesma ordem de `Anexo6.colunas`. */
  valores: Prisma.Decimal[];
  /** Coluna "Total" do anexo: soma SIMPLES das colunas de Cargo, sem ponderar
   *  pelo headcount — é o comportamento do anexo de referência (decisão do
   *  usuário 2026-09-21, "como pdf"). */
  total: Prisma.Decimal;
};

export type BlocoAnexo6 = { codigo: string; titulo: string; linhas: LinhaAnexo6[] };

export type ColunaCargoAnexo6 = { id: string; nome: string; quantidadeEmpregados: number };

export type Anexo6 = {
  colunas: ColunaCargoAnexo6[];
  blocos: BlocoAnexo6[];
  quantidadeTotalEmpregados: number;
};

const ZERO = new Prisma.Decimal(0);

/** RN0252 — dinheiro do relatório é sempre 2 casas, half-even. Cada rubrica é
 *  arredondada ANTES de entrar no subtotal, para que a coluna impressa feche
 *  exatamente na soma (é o que um analista de prestação de contas confere). */
function dinheiro(valor: Prisma.Decimal): Prisma.Decimal {
  return valor.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);
}

function percentualSobre(base: Prisma.Decimal, percentual: string): Prisma.Decimal {
  return dinheiro(base.times(percentual).dividedBy(100));
}

function somar(valores: Prisma.Decimal[]): Prisma.Decimal {
  return valores.reduce((acc, valor) => acc.plus(valor), ZERO);
}

/** Composição completa de UM Cargo — uma coluna do anexo. */
type ComposicaoCargo = {
  modulo1: { A: Prisma.Decimal; B: Prisma.Decimal; C: Prisma.Decimal; D: Prisma.Decimal; E: Prisma.Decimal; F: Prisma.Decimal; G: Prisma.Decimal; total: Prisma.Decimal };
  sub21: { A: Prisma.Decimal; B: Prisma.Decimal; total: Prisma.Decimal };
  sub22: { A: Prisma.Decimal; B: Prisma.Decimal; C: Prisma.Decimal; D: Prisma.Decimal; E: Prisma.Decimal; F: Prisma.Decimal; G: Prisma.Decimal; H: Prisma.Decimal; total: Prisma.Decimal };
  sub23: { A: Prisma.Decimal; B: Prisma.Decimal; C: Prisma.Decimal; D: Prisma.Decimal; total: Prisma.Decimal };
  modulo2Total: Prisma.Decimal;
  modulo3: { F: Prisma.Decimal; total: Prisma.Decimal };
  modulo4Total: Prisma.Decimal;
  modulo5Total: Prisma.Decimal;
  modulo6: { custosIndiretos: Prisma.Decimal; lucro: Prisma.Decimal; pis: Prisma.Decimal; tributosEstaduais: Prisma.Decimal; iss: Prisma.Decimal; tributos: Prisma.Decimal; total: Prisma.Decimal };
  subtotalAE: Prisma.Decimal;
  valorTotalPorEmpregado: Prisma.Decimal;
};

/**
 * Base de incidência dos Módulos 2.1, 2.2 e 3.
 *
 * É o `Cargo.salarioTotal` — que já é "valor da Fonte Ativa + Função
 * Gratificada" (US-107, `calcularSalarioTotalCargo`), ou seja, as linhas A + G
 * do Módulo 1. Fica de fora só Periculosidade/Insalubridade, coerente com
 * `calcularCustoTotalCargo` (ADR-044: adicionais entram DEPOIS dos encargos e
 * nunca compõem a base).
 *
 * ATENÇÃO — regra a confirmar com AN/PO: no anexo de referência os adicionais
 * são zero, então esse critério e "encargos sobre o Módulo 1 inteiro" dão o
 * mesmo número; a divergência só aparece em Cargo com adicional ativo. Trocar
 * de critério é mudar esta única função.
 */
function baseDeEncargos(salarioTotal: Prisma.Decimal): Prisma.Decimal {
  return salarioTotal;
}

function comporCargo(cargo: CargoParaAnexo6, diasUteisPadrao: number, pct: PercentuaisAnexo6): ComposicaoCargo {
  // `Cargo.salarioTotal` NÃO é a linha A do anexo: ele já embute a Função
  // Gratificada (US-107). A linha A é o salário sem a gratificação, que volta
  // sozinha na linha G — somar as duas sem descontar contaria a gratificação
  // duas vezes e inflaria Módulo 1, Subtotal, PIS, ISS e o Valor Total.
  const salarioTotal = dinheiro(new Prisma.Decimal(cargo.salarioTotal));
  const componentes = calcularBreakdownComponenteCusto(cargo, cargo.salarioTotal, diasUteisPadrao);
  const gratificacao = dinheiro(componentes.gratificacao);
  const salarioBase = salarioTotal.minus(gratificacao);
  const base = baseDeEncargos(salarioTotal);

  const modulo1 = {
    A: salarioBase,
    B: dinheiro(componentes.periculosidade),
    C: dinheiro(componentes.insalubridade),
    D: ZERO, // Adicional Noturno — não modelado no SGO
    E: ZERO, // Hora Noturna Reduzida — não modelado no SGO
    F: ZERO, // Hora Extra — não modelado no SGO
    G: gratificacao,
    total: ZERO,
  };
  modulo1.total = somar([modulo1.A, modulo1.B, modulo1.C, modulo1.D, modulo1.E, modulo1.F, modulo1.G]);

  const sub21 = {
    A: percentualSobre(base, pct.decimoTerceiro),
    B: percentualSobre(base, pct.ferias),
    total: ZERO,
  };
  sub21.total = somar([sub21.A, sub21.B]);

  const sub22 = {
    A: percentualSobre(base, pct.inss),
    B: percentualSobre(base, pct.salarioEducacao),
    C: percentualSobre(base, pct.sat),
    D: percentualSobre(base, pct.sescSesi),
    E: percentualSobre(base, pct.senaiSenac),
    F: percentualSobre(base, pct.sebrae),
    G: percentualSobre(base, pct.incra),
    H: percentualSobre(base, pct.fgts),
    total: ZERO,
  };
  sub22.total = somar([sub22.A, sub22.B, sub22.C, sub22.D, sub22.E, sub22.F, sub22.G, sub22.H]);

  const sub23 = {
    A: dinheiro(componentes.valeTransporte),
    B: dinheiro(componentes.valeAlimentacao.plus(componentes.valeRefeicao)),
    C: dinheiro(componentes.planoSaude.plus(componentes.planoOdontologico).plus(componentes.seguroVida)),
    D: dinheiro(componentes.auxilioCreche),
    total: ZERO,
  };
  sub23.total = somar([sub23.A, sub23.B, sub23.C, sub23.D]);

  const modulo2Total = somar([sub21.total, sub22.total, sub23.total]);

  const modulo3 = { F: percentualSobre(base, pct.provisaoRescisao), total: ZERO };
  modulo3.total = modulo3.F;

  // Módulos 4 e 5 não têm fonte de dado no SGO — saem zerados, com as rubricas
  // impressas, exatamente como no anexo de referência.
  const modulo4Total = ZERO;
  const modulo5Total = ZERO;

  const subtotalAE = somar([modulo1.total, modulo2Total, modulo3.total, modulo4Total, modulo5Total]);

  // PIS incide "por fora", sobre o Módulo 1 (é assim no anexo de referência).
  const pis = percentualSobre(modulo1.total, pct.pis);
  const custosIndiretos = ZERO;
  const lucro = ZERO;
  const tributosEstaduais = ZERO;

  // ISS incide "por dentro": o preço final é a base dividida por (1 - alíquota),
  // e o imposto é a diferença — assim o anexo fecha na soma sem sobra de centavo.
  const baseIss = somar([subtotalAE, custosIndiretos, lucro, pis, tributosEstaduais]);
  const divisor = new Prisma.Decimal(1).minus(new Prisma.Decimal(pct.iss).dividedBy(100));
  const valorComIss = divisor.isZero() ? baseIss : baseIss.dividedBy(divisor);
  const iss = dinheiro(valorComIss.minus(baseIss));

  const tributos = somar([pis, tributosEstaduais, iss]);
  const modulo6Total = somar([custosIndiretos, lucro, tributos]);

  return {
    modulo1,
    sub21,
    sub22,
    sub23,
    modulo2Total,
    modulo3,
    modulo4Total,
    modulo5Total,
    modulo6: { custosIndiretos, lucro, pis, tributosEstaduais, iss, tributos, total: modulo6Total },
    subtotalAE,
    valorTotalPorEmpregado: subtotalAE.plus(modulo6Total),
  };
}

function linha(
  rubrica: Pick<RubricaFixa, 'codigo' | 'rotulo' | 'percentual'>,
  nivel: NivelLinhaAnexo6,
  valores: Prisma.Decimal[],
): LinhaAnexo6 {
  return {
    codigo: rubrica.codigo,
    rotulo: rubrica.rotulo,
    percentual: rubrica.percentual === null ? null : new Prisma.Decimal(rubrica.percentual),
    nivel,
    valores,
    total: somar(valores),
  };
}

function linhaTotal(rotulo: string, valores: Prisma.Decimal[], nivel: NivelLinhaAnexo6 = 'subtotal'): LinhaAnexo6 {
  return { codigo: '', rotulo, percentual: null, nivel, valores, total: somar(valores) };
}

/**
 * Monta o ANEXO 6 — Composição dos Custos de Remuneração e Benefícios
 * (Empregados) de uma Proposta: uma coluna por Cargo, na estrutura de Módulos
 * 1 a 6 da IN 05/2017, mais a coluna Total (soma simples das colunas).
 *
 * Função PURA — recebe os Cargos já lidos do banco, não toca em Prisma. Todo o
 * dinheiro é `Prisma.Decimal`, nunca `number` (protocolo transacional do
 * projeto: valor financeiro não passa por ponto flutuante).
 */
export function montarAnexo6(
  cargos: CargoParaAnexo6[],
  diasUteisPadrao: number,
  percentuais: PercentuaisAnexo6 = PERCENTUAIS_ANEXO6,
): Anexo6 {
  const composicoes = cargos.map((cargo) => comporCargo(cargo, diasUteisPadrao, percentuais));
  const coluna = (extrair: (c: ComposicaoCargo) => Prisma.Decimal): Prisma.Decimal[] => composicoes.map(extrair);

  const blocos: BlocoAnexo6[] = [
    {
      codigo: '1',
      titulo: 'Módulo 1 - Composição da Remuneração',
      linhas: [
        linha(RUBRICAS_MODULO_1.salarioBase, 'rubrica', coluna((c) => c.modulo1.A)),
        linha(RUBRICAS_MODULO_1.periculosidade, 'rubrica', coluna((c) => c.modulo1.B)),
        linha(RUBRICAS_MODULO_1.insalubridade, 'rubrica', coluna((c) => c.modulo1.C)),
        linha(RUBRICAS_MODULO_1.adicionalNoturno, 'rubrica', coluna((c) => c.modulo1.D)),
        linha(RUBRICAS_MODULO_1.horaNoturnaReduzida, 'rubrica', coluna((c) => c.modulo1.E)),
        linha(RUBRICAS_MODULO_1.horaExtra, 'rubrica', coluna((c) => c.modulo1.F)),
        linha(RUBRICAS_MODULO_1.outros, 'rubrica', coluna((c) => c.modulo1.G)),
        linhaTotal('Total', coluna((c) => c.modulo1.total)),
      ],
    },
    {
      codigo: '2.1',
      titulo: 'Submódulo 2.1 - 13º (décimo terceiro) Salário, Férias e Adicional de Férias',
      linhas: [
        linha(RUBRICAS_SUBMODULO_2_1.decimoTerceiro, 'rubrica', coluna((c) => c.sub21.A)),
        linha(RUBRICAS_SUBMODULO_2_1.ferias, 'rubrica', coluna((c) => c.sub21.B)),
        linhaTotal('Total', coluna((c) => c.sub21.total)),
      ],
    },
    {
      codigo: '2.2',
      titulo: 'Submódulo 2.2 - Encargos Previdenciários (GPS), FGTS e outras contribuições',
      linhas: [
        linha(RUBRICAS_SUBMODULO_2_2.inss, 'rubrica', coluna((c) => c.sub22.A)),
        linha(RUBRICAS_SUBMODULO_2_2.salarioEducacao, 'rubrica', coluna((c) => c.sub22.B)),
        linha(RUBRICAS_SUBMODULO_2_2.sat, 'rubrica', coluna((c) => c.sub22.C)),
        linha(RUBRICAS_SUBMODULO_2_2.sescSesi, 'rubrica', coluna((c) => c.sub22.D)),
        linha(RUBRICAS_SUBMODULO_2_2.senaiSenac, 'rubrica', coluna((c) => c.sub22.E)),
        linha(RUBRICAS_SUBMODULO_2_2.sebrae, 'rubrica', coluna((c) => c.sub22.F)),
        linha(RUBRICAS_SUBMODULO_2_2.incra, 'rubrica', coluna((c) => c.sub22.G)),
        linha(RUBRICAS_SUBMODULO_2_2.fgts, 'rubrica', coluna((c) => c.sub22.H)),
        linhaTotal('Total', coluna((c) => c.sub22.total)),
      ],
    },
    {
      codigo: '2.3',
      titulo: 'Submódulo 2.3 - Benefícios Mensais e Diários',
      linhas: [
        linha(RUBRICAS_SUBMODULO_2_3.transporte, 'rubrica', coluna((c) => c.sub23.A)),
        linha(RUBRICAS_SUBMODULO_2_3.alimentacao, 'rubrica', coluna((c) => c.sub23.B)),
        linha(RUBRICAS_SUBMODULO_2_3.assistencia, 'rubrica', coluna((c) => c.sub23.C)),
        linha(RUBRICAS_SUBMODULO_2_3.outros, 'rubrica', coluna((c) => c.sub23.D)),
        linhaTotal('Total', coluna((c) => c.sub23.total)),
      ],
    },
    {
      codigo: '2',
      titulo: 'Quadro-Resumo do Módulo 2 - Encargos e Benefícios anuais, mensais e diários',
      linhas: [
        linha({ codigo: '2.1', rotulo: '13º (décimo terceiro) Salário, Férias e Adicional de Férias', percentual: null }, 'rubrica', coluna((c) => c.sub21.total)),
        linha({ codigo: '2.2', rotulo: 'GPS, FGTS e outras contribuições', percentual: null }, 'rubrica', coluna((c) => c.sub22.total)),
        linha({ codigo: '2.3', rotulo: 'Benefícios Mensais e Diários', percentual: null }, 'rubrica', coluna((c) => c.sub23.total)),
        linhaTotal('Total', coluna((c) => c.modulo2Total)),
      ],
    },
    {
      codigo: '3',
      titulo: 'Módulo 3 - Provisão para Rescisão',
      linhas: [
        linha(RUBRICAS_MODULO_3.avisoPrevioIndenizado, 'rubrica', coluna(() => ZERO)),
        linha(RUBRICAS_MODULO_3.fgtsSobreAvisoIndenizado, 'rubrica', coluna(() => ZERO)),
        linha(RUBRICAS_MODULO_3.multaFgtsAvisoIndenizado, 'rubrica', coluna(() => ZERO)),
        linha(RUBRICAS_MODULO_3.avisoPrevioTrabalhado, 'rubrica', coluna(() => ZERO)),
        linha(RUBRICAS_MODULO_3.encargos22SobreAvisoTrabalhado, 'rubrica', coluna(() => ZERO)),
        linha(RUBRICAS_MODULO_3.multaFgtsAvisoTrabalhado, 'rubrica', coluna((c) => c.modulo3.F)),
        linhaTotal('Total', coluna((c) => c.modulo3.total)),
      ],
    },
    {
      codigo: '4.1',
      titulo: 'Submódulo 4.1 - Ausências Legais',
      linhas: [
        ...RUBRICAS_SUBMODULO_4_1.map((r) => linha(r, 'rubrica', coluna(() => ZERO))),
        linhaTotal('Total', coluna(() => ZERO)),
      ],
    },
    {
      codigo: '4.2',
      titulo: 'Submódulo 4.2 - Intrajornada',
      linhas: [
        ...RUBRICAS_SUBMODULO_4_2.map((r) => linha(r, 'rubrica', coluna(() => ZERO))),
        linhaTotal('Total', coluna(() => ZERO)),
      ],
    },
    {
      codigo: '4',
      titulo: 'Quadro-Resumo do Módulo 4 - Custo de Reposição do Profissional Ausente',
      linhas: [
        linha({ codigo: '4.1', rotulo: 'Ausências Legais', percentual: null }, 'rubrica', coluna(() => ZERO)),
        linha({ codigo: '4.2', rotulo: 'Intrajornada', percentual: null }, 'rubrica', coluna(() => ZERO)),
        linhaTotal('Total', coluna((c) => c.modulo4Total)),
      ],
    },
    {
      codigo: '5',
      titulo: 'Módulo 5 - Insumos Diversos',
      linhas: [
        ...RUBRICAS_MODULO_5.map((r) => linha(r, 'rubrica', coluna(() => ZERO))),
        linhaTotal('Total', coluna((c) => c.modulo5Total)),
      ],
    },
    {
      codigo: '6',
      titulo: 'Módulo 6 - Custos Indiretos, Tributos e Lucro',
      linhas: [
        linha(RUBRICAS_MODULO_6.custosIndiretos, 'rubrica', coluna((c) => c.modulo6.custosIndiretos)),
        linha(RUBRICAS_MODULO_6.lucro, 'rubrica', coluna((c) => c.modulo6.lucro)),
        // O anexo de referência imprime "C Tributos" sempre 0,00, como mero
        // rótulo das linhas C.1/C.2/C.3. Aqui C é o subtotal real das três —
        // o Total do Módulo 6 continua idêntico, e a coluna passa a fechar.
        linhaTotal('C  Tributos', coluna((c) => c.modulo6.tributos), 'rubrica'),
        linha(RUBRICAS_MODULO_6.pis, 'rubrica', coluna((c) => c.modulo6.pis)),
        linha(RUBRICAS_MODULO_6.tributosEstaduais, 'rubrica', coluna((c) => c.modulo6.tributosEstaduais)),
        linha(RUBRICAS_MODULO_6.iss, 'rubrica', coluna((c) => c.modulo6.iss)),
        linhaTotal('Total', coluna((c) => c.modulo6.total)),
      ],
    },
    {
      codigo: 'RESUMO',
      titulo: '2. QUADRO-RESUMO DO CUSTO POR EMPREGADO',
      linhas: [
        linha({ codigo: 'A', rotulo: 'Módulo 1 - Composição da Remuneração', percentual: null }, 'rubrica', coluna((c) => c.modulo1.total)),
        linha({ codigo: 'B', rotulo: 'Módulo 2 - Encargos e Benefícios Anuais, Mensais e Diários', percentual: null }, 'rubrica', coluna((c) => c.modulo2Total)),
        linha({ codigo: 'C', rotulo: 'Módulo 3 - Provisão para Rescisão', percentual: null }, 'rubrica', coluna((c) => c.modulo3.total)),
        linha({ codigo: 'D', rotulo: 'Módulo 4 - Custo de Reposição do Profissional Ausente', percentual: null }, 'rubrica', coluna((c) => c.modulo4Total)),
        linha({ codigo: 'E', rotulo: 'Módulo 5 - Insumos Diversos', percentual: null }, 'rubrica', coluna((c) => c.modulo5Total)),
        linhaTotal('Subtotal (A + B + C + D + E)', coluna((c) => c.subtotalAE)),
        linha({ codigo: 'F', rotulo: 'Módulo 6 – Custos Indiretos, Tributos e Lucro', percentual: null }, 'rubrica', coluna((c) => c.modulo6.total)),
        linhaTotal('Valor Total por Empregado', coluna((c) => c.valorTotalPorEmpregado), 'total'),
      ],
    },
  ];

  return {
    colunas: cargos.map((c) => ({ id: c.id, nome: c.nomeCargoMercado, quantidadeEmpregados: c.quantidadeEmpregados })),
    blocos,
    quantidadeTotalEmpregados: cargos.reduce((acc, c) => acc + c.quantidadeEmpregados, 0),
  };
}
