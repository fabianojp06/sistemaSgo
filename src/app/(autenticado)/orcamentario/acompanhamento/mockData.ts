/**
 * [LAYOUT — placeholder] Estrutura extraída de src/application/use-cases/plano-contas/MODELO.xlsx
 * (aba "ACOMP"), só para dar forma à tela enquanto a US formal (regras de
 * negócio, caso de uso, critérios de aceite) não existe. Nenhum destes
 * números vem de cálculo real — trocar por dado de verdade quando a US for
 * escrita e implementada.
 */

export type LinhaDespesaMock = {
  codigo: string;
  nome: string;
  valoresPorMes: { previsto: number; realizado: number; saldoAcumulado: number }[];
};

export type LinhaResumoMock = {
  label: string;
  valoresPorMes: number[];
};

export const mesesMock = ['Set/2023', 'Out/2023', 'Nov/2023', 'Dez/2023'];

export const resumoTopoMock: LinhaResumoMock[] = [
  { label: 'Cronograma de Desembolso', valoresPorMes: [13358703, 0, 0, 0] },
  { label: 'Parcela Mensal Recebida (Previsto)', valoresPorMes: [0, 15327000, 0, 0] },
  { label: 'Parcela Mensal Recebida (Realizado)', valoresPorMes: [0, 15327000, 15327000, 15327000] },
];

export const linhasDespesaMock: LinhaDespesaMock[] = [
  {
    codigo: '4.1.1.1',
    nome: 'Despesas de Pessoal',
    valoresPorMes: [
      { previsto: 965585, realizado: 561295.62, saldoAcumulado: 404289.38 },
      { previsto: 758724, realizado: 907558.16, saldoAcumulado: 255455.22 },
      { previsto: 758724, realizado: 528831.08, saldoAcumulado: 485348.14 },
      { previsto: 782729, realizado: 611334.72, saldoAcumulado: 656742.42 },
    ],
  },
  {
    codigo: '4.1.1.2',
    nome: 'Encargos Sociais',
    valoresPorMes: [
      { previsto: 241078, realizado: 0, saldoAcumulado: 241078 },
      { previsto: 220160, realizado: 178101.03, saldoAcumulado: 283136.97 },
      { previsto: 220160, realizado: 186133.08, saldoAcumulado: 317163.89 },
      { previsto: 385184, realizado: 309541.96, saldoAcumulado: 392805.93 },
    ],
  },
  {
    codigo: '4.1.1.3',
    nome: 'Despesa de Viagem',
    valoresPorMes: [
      { previsto: 19333, realizado: 5156.52, saldoAcumulado: 14176.48 },
      { previsto: 19333, realizado: 5808.75, saldoAcumulado: 27700.73 },
      { previsto: 19333, realizado: 30314.94, saldoAcumulado: 16718.79 },
      { previsto: 19333, realizado: 8332.23, saldoAcumulado: 27719.56 },
    ],
  },
  {
    codigo: '4.1.1.4',
    nome: 'Despesa de Diária',
    valoresPorMes: [
      { previsto: 9936, realizado: 5438.95, saldoAcumulado: 4497.05 },
      { previsto: 9936, realizado: 4687.31, saldoAcumulado: 9745.74 },
      { previsto: 9936, realizado: 7361.14, saldoAcumulado: 12320.6 },
      { previsto: 9936, realizado: 2256.49, saldoAcumulado: 20000.11 },
    ],
  },
  {
    codigo: '4.1.1.5',
    nome: 'Despesas Administrativas',
    valoresPorMes: [
      { previsto: 4100, realizado: 1582.45, saldoAcumulado: 2517.55 },
      { previsto: 4100, realizado: 1568.7, saldoAcumulado: 5048.85 },
      { previsto: 4100, realizado: 611.66, saldoAcumulado: 8537.19 },
      { previsto: 4100, realizado: 1347.3, saldoAcumulado: 11289.89 },
    ],
  },
  {
    codigo: '4.1.1.6',
    nome: 'Despesas Gerais',
    valoresPorMes: [
      { previsto: 28139, realizado: 1223.43, saldoAcumulado: 26915.57 },
      { previsto: 25139, realizado: 3628.27, saldoAcumulado: 48426.3 },
      { previsto: 25139, realizado: 14896.89, saldoAcumulado: 58668.41 },
      { previsto: 25139, realizado: 13126.83, saldoAcumulado: 70680.58 },
    ],
  },
  {
    codigo: '4.1.1.7',
    nome: 'Imobilizado/Intangível',
    valoresPorMes: [
      { previsto: 0, realizado: 0, saldoAcumulado: 0 },
      { previsto: 0, realizado: 0, saldoAcumulado: 0 },
      { previsto: 0, realizado: 0, saldoAcumulado: 0 },
      { previsto: 0, realizado: 0, saldoAcumulado: 0 },
    ],
  },
  {
    codigo: '4.1.1.8',
    nome: 'Impostos a Recolher',
    valoresPorMes: [
      { previsto: 13946, realizado: 122.82, saldoAcumulado: 13823.18 },
      { previsto: 1003896, realizado: 766464.87, saldoAcumulado: 251254.31 },
      { previsto: 13946, realizado: 0, saldoAcumulado: 265200.31 },
      { previsto: 13946, realizado: 0, saldoAcumulado: 279146.31 },
    ],
  },
  {
    codigo: '4.1.1.9',
    nome: 'Projetos',
    valoresPorMes: [
      { previsto: 800000, realizado: 0, saldoAcumulado: 800000 },
      { previsto: 0, realizado: 0, saldoAcumulado: 800000 },
      { previsto: 0, realizado: 0, saldoAcumulado: 800000 },
      { previsto: 1000000, realizado: 0, saldoAcumulado: 1800000 },
    ],
  },
  {
    codigo: '4.2',
    nome: 'Encargos Financeiros',
    valoresPorMes: [
      { previsto: 0, realizado: 0, saldoAcumulado: 0 },
      { previsto: 0, realizado: 0, saldoAcumulado: 0 },
      { previsto: 0, realizado: 0, saldoAcumulado: 0 },
      { previsto: 0, realizado: 0, saldoAcumulado: 0 },
    ],
  },
  {
    codigo: '4.3.1.1',
    nome: 'Despesas Não Operacionais',
    valoresPorMes: [
      { previsto: 0, realizado: 0, saldoAcumulado: 0 },
      { previsto: 0, realizado: 0, saldoAcumulado: 0 },
      { previsto: 0, realizado: 0, saldoAcumulado: 0 },
      { previsto: 0, realizado: 0, saldoAcumulado: 0 },
    ],
  },
  {
    codigo: '4.4.1.1',
    nome: 'Rateio das Despesas',
    valoresPorMes: [
      { previsto: 115894, realizado: 45465.68, saldoAcumulado: 70428.32 },
      { previsto: 140910, realizado: 91857.06, saldoAcumulado: 119481.26 },
      { previsto: 123256, realizado: 58483.77, saldoAcumulado: 184253.49 },
      { previsto: 144964, realizado: 90281.89, saldoAcumulado: 238935.6 },
    ],
  },
];

export const totalGeralMock: { previsto: number; realizado: number; saldoAcumulado: number }[] = [
  { previsto: 2198011, realizado: 620285.47, saldoAcumulado: 1577725.53 },
  { previsto: 2182198, realizado: 1959674.15, saldoAcumulado: 1800249.38 },
  { previsto: 1174594, realizado: 826632.56, saldoAcumulado: 2148210.82 },
  { previsto: 2385331, realizado: 1036221.42, saldoAcumulado: 3497320.4 },
];

export const resumoRodapeMock: LinhaResumoMock[] = [
  { label: 'Valor Realizado Acumulado', valoresPorMes: [620285.47, 2579959.62, 3406592.18, 4442813.6] },
  { label: 'Parcela Mensal Recebida', valoresPorMes: [-620285.47, 13367325.85, -826632.56, -1036221.42] },
  { label: 'Rendimentos de Aplicação', valoresPorMes: [0, 1996.18, 18059.21, 54201.77] },
  { label: 'Saldo com Rendimentos', valoresPorMes: [-620285.47, 12749036.56, 11940463.21, 10958443.56] },
  { label: 'Saldo Disponível', valoresPorMes: [-620285.47, 12747040.38, 11920407.82, 10884186.4] },
];
