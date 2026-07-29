export type ContaContabilPayload = {
  codigoErp: string;
  nomeConta: string;
  nivel: number;
  codigoPaiErp: string | null;
  isAnalitica: boolean;
};

/**
 * Substitui o SeniorIntegrationController enquanto não há integração real com o
 * ERP Senior [decisão de escopo: cenário de teste com plano de contas fictício,
 * 4 níveis, formato N.N.NN.NNN]. Mesmo contrato de saída de um provider real —
 * trocar a integração depois é só implementar esta interface com uma chamada HTTP.
 */
export class PlanoContasFixtureProvider {
  async buscarContasAtivas(): Promise<ContaContabilPayload[]> {
    return PLANO_CONTAS_FICTICIO;
  }
}

const PLANO_CONTAS_FICTICIO: ContaContabilPayload[] = [
  { codigoErp: '1', nomeConta: 'Ativo', nivel: 1, codigoPaiErp: null, isAnalitica: false },
  { codigoErp: '1.1', nomeConta: 'Ativo Circulante', nivel: 2, codigoPaiErp: '1', isAnalitica: false },
  { codigoErp: '1.1.11', nomeConta: 'Caixa e Equivalentes', nivel: 3, codigoPaiErp: '1.1', isAnalitica: false },
  { codigoErp: '1.1.11.111', nomeConta: 'Caixa', nivel: 4, codigoPaiErp: '1.1.11', isAnalitica: true },
  { codigoErp: '1.1.11.112', nomeConta: 'Bancos Conta Movimento', nivel: 4, codigoPaiErp: '1.1.11', isAnalitica: true },
  { codigoErp: '1.1.12', nomeConta: 'Contas a Receber', nivel: 3, codigoPaiErp: '1.1', isAnalitica: false },
  { codigoErp: '1.1.12.121', nomeConta: 'Clientes Nacionais', nivel: 4, codigoPaiErp: '1.1.12', isAnalitica: true },

  { codigoErp: '3', nomeConta: 'Despesas', nivel: 1, codigoPaiErp: null, isAnalitica: false },
  { codigoErp: '3.1', nomeConta: 'Despesas Operacionais', nivel: 2, codigoPaiErp: '3', isAnalitica: false },
  { codigoErp: '3.1.31', nomeConta: 'Despesas com Pessoal', nivel: 3, codigoPaiErp: '3.1', isAnalitica: false },
  { codigoErp: '3.1.31.311', nomeConta: 'Salários', nivel: 4, codigoPaiErp: '3.1.31', isAnalitica: true },
  { codigoErp: '3.1.31.312', nomeConta: 'Encargos Sociais', nivel: 4, codigoPaiErp: '3.1.31', isAnalitica: true },
  { codigoErp: '3.1.32', nomeConta: 'Despesas Administrativas', nivel: 3, codigoPaiErp: '3.1', isAnalitica: false },
  { codigoErp: '3.1.32.321', nomeConta: 'Material de Escritório', nivel: 4, codigoPaiErp: '3.1.32', isAnalitica: true },
  { codigoErp: '3.1.32.322', nomeConta: 'Passagens Aéreas Nacionais', nivel: 4, codigoPaiErp: '3.1.32', isAnalitica: true },
  { codigoErp: '3.1.32.323', nomeConta: 'Passagens Aéreas Internacionais', nivel: 4, codigoPaiErp: '3.1.32', isAnalitica: true },
];
