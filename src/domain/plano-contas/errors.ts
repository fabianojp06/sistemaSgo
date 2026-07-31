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

// US-003, Cenário 4 — Tag de Natureza só é configurável em conta analítica.
export class ContaNaoAnaliticaError extends Error {
  constructor() {
    super('Tags de Natureza são configuráveis somente em contas analíticas.');
    this.name = 'ContaNaoAnaliticaError';
  }
}

// US-007, Cenário 3 — valor orçado só é aceito em conta analítica (isAnalitica=true).
export class ValorOrcadoContaSinteticaError extends Error {
  constructor() {
    super(
      'Valor não pode ser inserido diretamente em conta sintética. O valor é calculado automaticamente pela soma das contas analíticas filhas.',
    );
    this.name = 'ValorOrcadoContaSinteticaError';
  }
}

// US-007, Cenário 4 — valor negativo ou não numérico bloqueia o salvamento.
export class ValorOrcadoInvalidoError extends Error {
  constructor() {
    super('Valor Inválido: informe um valor monetário maior ou igual a zero.');
    this.name = 'ValorOrcadoInvalidoError';
  }
}

// US-008 — Semáforo Orçamentário só é configurável em conta analítica.
export class SemaforoContaSinteticaError extends Error {
  constructor() {
    super('Limiares do Semáforo Orçamentário só podem ser configurados em contas analíticas.');
    this.name = 'SemaforoContaSinteticaError';
  }
}

// US-008, Cenário 2 — Amarelo <= Verde.
export class SemaforoLimiarAmareloInvalidoError extends Error {
  constructor() {
    super('Configuração Inválida: O limiar Amarelo deve ser maior que o limiar Verde. Verifique os percentuais informados.');
    this.name = 'SemaforoLimiarAmareloInvalidoError';
  }
}

// US-008, Cenário 2a — Laranja <= Amarelo.
export class SemaforoLimiarLaranjaInvalidoError extends Error {
  constructor() {
    super('Configuração Inválida: O limiar Laranja deve ser maior que o limiar Amarelo. Verifique os percentuais informados.');
    this.name = 'SemaforoLimiarLaranjaInvalidoError';
  }
}

// US-008, Cenário 2b — percentual fora de 1-100.
export class SemaforoPercentualForaDaFaixaError extends Error {
  constructor() {
    super('Configuração Inválida: os percentuais devem estar entre 1 e 100.');
    this.name = 'SemaforoPercentualForaDaFaixaError';
  }
}

// US-102, Cenário 2 [TRAVA O ERRO] — campo obrigatório em branco.
export class CamposObrigatoriosPropostaError extends Error {
  constructor() {
    super(
      'Operação Rejeitada [TRAVA O ERRO]: Os campos Tipo, Nome/Objeto, Data de Início, Data de Término e Categoria são obrigatórios e não podem ser nulos.',
    );
    this.name = 'CamposObrigatoriosPropostaError';
  }
}

// US-102, Cenário 3 [TRAVA O ERRO] — Data de Término <= Data de Início.
export class DatasPropostaInvalidasError extends Error {
  constructor() {
    super(
      'Erro de Validação [TRAVA O ERRO]: A Data de Término não pode ser inferior ou igual à Data de Início configurada para o Termo de Parceria.',
    );
    this.name = 'DatasPropostaInvalidasError';
  }
}

// US-102 — geração automática do código da Proposta esgotou as tentativas de retry.
export class CodigoPropostaGeracaoFalhouError extends Error {
  constructor() {
    super('Não foi possível gerar um código único para a Proposta. Tente novamente.');
    this.name = 'CodigoPropostaGeracaoFalhouError';
  }
}

// US-101, Cenário 5, RN_PRO_010 — Termo de Parceria tem imunidade tributária:
// tributos com tipoIncidencia=CONTRATO não podem ser aplicados.
export class ImpostoNaoDisponivelParaTipoPropostaError extends Error {
  constructor() {
    super('Termos de Parceria possuem imunidade tributária — PIS e COFINS não podem ser aplicados (RN_PRO_010).');
    this.name = 'ImpostoNaoDisponivelParaTipoPropostaError';
  }
}

// US-101 — parâmetro fiscal referenciado não existe para o tenant.
export class AliquotaImpostoNaoEncontradaError extends Error {
  constructor() {
    super('Imposto/tributo não encontrado. Verifique se ele está cadastrado nos parâmetros fiscais.');
    this.name = 'AliquotaImpostoNaoEncontradaError';
  }
}

// US-101, Cenário 4 [TRAVA O ERRO] — Versão Oficializada tem dados fiscais congelados.
export class VersaoOficializadaCongeladaError extends Error {
  constructor() {
    super(
      'Ação Negada [TRAVA O ERRO]: Esta Proposta está oficializada e seus dados fiscais estão congelados. Nenhuma alteração é permitida.',
    );
    this.name = 'VersaoOficializadaCongeladaError';
  }
}

// US-007 — operação em versão de proposta que não pertence ao tenant, não existe,
// ou não está em estado editável (RASCUNHO/EM_ELABORACAO).
export class VersaoPropostaInvalidaError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'VersaoPropostaInvalidaError';
  }
}

// US-003, Cenário 2, RN_PLA_005 — natureza da conta filha deve ser consistente com a
// hierarquia; regra simétrica (bloqueia OPEX sob ancestral CAPEX e vice-versa).
export class NaturezaHierarquiaInvalidaError extends Error {
  constructor(public readonly naturezaAncestral: 'OPEX' | 'CAPEX', public readonly naturezaTentativa: 'OPEX' | 'CAPEX') {
    super(
      `Classificação Inválida [TRAVA O ERRO]: A conta sintética pai desta conta está classificada como ${naturezaAncestral}. Não é permitido classificar uma conta filha como ${naturezaTentativa} — a natureza deve ser consistente com a hierarquia.`,
    );
    this.name = 'NaturezaHierarquiaInvalidaError';
  }
}
