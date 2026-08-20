/**
 * [LAYOUT — placeholder] Estrutura extraída de src/application/use-cases/plano-contas/MODELO.xlsx
 * (aba "ORÇADO"), só para dar forma à tela enquanto a US formal (regras de
 * negócio, caso de uso, critérios de aceite) não existe. Nenhum destes
 * números vem de cálculo real. A planilha original tem ~219 linhas / 5
 * níveis de conta e cobre vários anos de vigência — este mock reproduz só um
 * recorte representativo da árvore (2 grupos de despesa, poucos itens cada)
 * para não poluir o layout antes das regras existirem.
 */

export type LinhaOrcadoMock = {
  codigo: string | null;
  nome: string;
  nivel: 1 | 2 | 3; // profundidade de indentação — 1: Despesas (topo), 2: elemento (ex: 4.1.1.1), 3: item analítico
  negrito?: boolean;
  valoresPorMes: number[];
};

// 4 meses "reais" (Set-Dez/23) + 1 coluna de subtotal trimestral, igual ao
// padrão da planilha original ("set/23 a dez/23").
export const colunasMock = ['Set/23', 'Out/23', 'Nov/23', 'Dez/23', 'Set/23 a Dez/23'];

export const headcountMock = [
  { label: 'Número de Empregados', valores: [75, 75, 75, 75, 75] },
  { label: 'Número de Estagiários', valores: [7, 7, 7, 7, 7] },
  { label: 'Número de Jovens Aprendizes', valores: [0, 0, 0, 0, 0] },
];

export const linhasOrcadoMock: LinhaOrcadoMock[] = [
  { codigo: '4', nome: 'DESPESAS', nivel: 1, negrito: true, valoresPorMes: [3123175.5, 3061932, 1577007, 3360550.5, 11122665] },
  { codigo: '4.1.1.1', nome: 'DESPESAS DE PESSOAL', nivel: 2, negrito: true, valoresPorMes: [1448377.5, 1138086, 1138086, 1174093.5, 4898643] },
  { codigo: '4.1.1.1.001', nome: 'Salários', nivel: 3, valoresPorMes: [620581.5, 620581.5, 620581.5, 620581.5, 2482326] },
  { codigo: '4.1.1.1.003', nome: 'Férias e terço constitucional', nivel: 3, valoresPorMes: [38733, 38733, 38733, 38733, 154932] },
  { codigo: '4.1.1.1.005', nome: '13º Salário', nivel: 3, valoresPorMes: [310291.5, 0, 0, 0, 310291.5] },
  { codigo: '4.1.1.1.009', nome: 'Vale-Refeição e Alimentação', nivel: 3, valoresPorMes: [180034.5, 180034.5, 180034.5, 216042, 756145.5] },
  { codigo: '4.1.1.1.010', nome: 'Vale-Transporte', nivel: 3, valoresPorMes: [16983, 16983, 16983, 16983, 67932] },
  { codigo: '4.1.1.2', nome: 'ENCARGOS SOCIAIS', nivel: 2, negrito: true, valoresPorMes: [241078, 220160, 220160, 385184, 1066582] },
  { codigo: '4.1.1.2.001', nome: 'INSS', nivel: 3, valoresPorMes: [130000, 118000, 118000, 205000, 571000] },
  { codigo: '4.1.1.2.005', nome: 'FGTS', nivel: 3, valoresPorMes: [50000, 45000, 45000, 80000, 220000] },
  { codigo: '4.1.1.2.010', nome: 'PIS s/ folha de pagamento', nivel: 3, valoresPorMes: [61078, 57160, 57160, 100184, 275582] },
];
