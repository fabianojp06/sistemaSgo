export class AcessoNegadoSincronismoError extends Error {
  constructor() {
    super('Perfil sem permissão para disparar sincronismo do Plano de Contas.');
    this.name = 'AcessoNegadoSincronismoError';
  }
}

export class SincronismoEmAndamentoError extends Error {
  constructor() {
    super('Já existe um sincronismo do Plano de Contas em andamento para este tenant.');
    this.name = 'SincronismoEmAndamentoError';
  }
}

// RN_PLA_002 / cenário E2 — lote abortado por conta analítica sem sintética pai.
export class ContasOrfasError extends Error {
  constructor(public readonly codigosOrfaos: string[]) {
    super(
      `Erro de Sincronismo [TRAVA O ERRO]: Ingestão abortada. Contas sem conta pai correspondente: ${codigosOrfaos.join(', ')}.`,
    );
    this.name = 'ContasOrfasError';
  }
}

// RN_PLA_008 — nome em branco ou menos de 2 contas analíticas.
export class AgrupadorInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'AgrupadorInvalidoError';
  }
}

// RN_PLA_008(a) — nome duplicado.
export class AgrupadorNomeDuplicadoError extends Error {
  constructor() {
    super('Já existe um Agrupador com este nome. Utilize um nome único.');
    this.name = 'AgrupadorNomeDuplicadoError';
  }
}

// RN_PLA_010 — exclusão bloqueada por referência ativa.
export class AgrupadorReferenciadoError extends Error {
  constructor() {
    super(
      'Exclusão Bloqueada: Este Agrupador está referenciado em documentos orçamentários ativos. Remova as referências antes de excluí-lo.',
    );
    this.name = 'AgrupadorReferenciadoError';
  }
}
