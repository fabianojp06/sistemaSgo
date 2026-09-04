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

// ADR-046 (US-137) — mesma família de erros do sincronismo do Plano de Contas,
// aplicada à Grade Salarial CTCEA.
export class AcessoNegadoSincronismoGradeSalarialCtceaError extends Error {
  constructor() {
    super('Perfil sem permissão para disparar sincronismo da Grade Salarial CTCEA.');
    this.name = 'AcessoNegadoSincronismoGradeSalarialCtceaError';
  }
}

export class SincronismoGradeSalarialCtceaEmAndamentoError extends Error {
  constructor() {
    super('Já existe um sincronismo da Grade Salarial CTCEA em andamento para este tenant.');
    this.name = 'SincronismoGradeSalarialCtceaEmAndamentoError';
  }
}

// ADR-047 (US-139) — mesma família de erros, aplicada ao Catálogo de Cargo de Mercado.
export class AcessoNegadoSincronismoCargoMercadoCatalogoError extends Error {
  constructor() {
    super('Perfil sem permissão para disparar sincronismo do Catálogo de Cargo de Mercado.');
    this.name = 'AcessoNegadoSincronismoCargoMercadoCatalogoError';
  }
}

export class SincronismoCargoMercadoCatalogoEmAndamentoError extends Error {
  constructor() {
    super('Já existe um sincronismo do Catálogo de Cargo de Mercado em andamento para este tenant.');
    this.name = 'SincronismoCargoMercadoCatalogoEmAndamentoError';
  }
}

// RN_PLA_002 / cenário E2 — lote abortado por conta analítica sem sintética pai.
export class ContasOrfasError extends Error {
  constructor(public readonly codigosOrfaos: string[]) {
    super(
      `Erro de Sincronismo: Ingestão abortada. Contas sem conta pai correspondente: ${codigosOrfaos.join(', ')}.`,
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

// US-106, Cenário 3 [TRAVA O ERRO] — vínculo pai-filho por tipo inválido.
export class VinculoHierarquicoInvalidoError extends Error {
  constructor() {
    super(
      'Vínculo Hierárquico Inválido: Coordenadoria/Setor só pode ser subordinado a uma unidade do tipo Gerência. Assessoria só pode ser subordinado a uma unidade do tipo Diretoria.',
    );
    this.name = 'VinculoHierarquicoInvalidoError';
  }
}

// US-106, Cenário 5 [TRAVA O ERRO] — unidade com cargo vinculado não pode ser inativada.
export class InativacaoUnidadeFuncionalBloqueadaError extends Error {
  constructor() {
    super(
      'Inativação Bloqueada: Esta unidade possui cargos vinculados. Remova ou realoque os cargos antes de inativá-la.',
    );
    this.name = 'InativacaoUnidadeFuncionalBloqueadaError';
  }
}

// US-106, Cenário 7 — Proposta fora de RASCUNHO/EM_ELABORACAO é imutável para escrita de Estrutura Funcional.
export class PropostaImutavelError extends Error {
  constructor() {
    super(
      'Ação Negada: Esta Proposta não está em Rascunho ou Em Elaboração. Nenhuma alteração é permitida.',
    );
    this.name = 'PropostaImutavelError';
  }
}

// US-105, Cenários 2/3 — outro usuário alterou o registro entre a leitura e este commit.
export class ConflitoConcorrenciaError extends Error {
  constructor() {
    super(
      'Conflito de Concorrência: Este registro foi alterado por outro usuário desde a última leitura. Recarregue os dados antes de salvar novamente.',
    );
    this.name = 'ConflitoConcorrenciaError';
  }
}

// US-103, Cenário 3 [TRAVA O ERRO] — versão Oficializada/Encerrada é imutável.
export class ExclusaoCicloVidaInvalidoError extends Error {
  constructor() {
    super(
      'Ação Negada: O ciclo de vida atual do projeto não permite exclusão. Documentos oficializados ou encerrados são estritamente imutáveis.',
    );
    this.name = 'ExclusaoCicloVidaInvalidoError';
  }
}

// US-103, Cenário 4 [TRAVA O ERRO] — não pode ser a única versão ativa da Proposta.
export class VersaoUnicaNaoPodeSerExcluidaError extends Error {
  constructor() {
    super('Exclusão Rejeitada: Não é possível excluir a única versão existente desta Proposta.');
    this.name = 'VersaoUnicaNaoPodeSerExcluidaError';
  }
}

// US-103, Cenário 2 [TRAVA O ERRO] — vínculos operacionais ativos (ValorOrcadoConta/RateioImpostoGrade).
export class VinculosAtivosImpedemExclusaoError extends Error {
  constructor() {
    super(
      'Exclusão Rejeitada: Operação bloqueada. A versão da proposta possui registros operacionais ou memórias de cálculo analíticas ativas vinculadas.',
    );
    this.name = 'VinculosAtivosImpedemExclusaoError';
  }
}

// US-104 — Proposta de origem para duplicação não encontrada.
export class PropostaNaoEncontradaError extends Error {
  constructor() {
    super('Proposta não encontrada.');
    this.name = 'PropostaNaoEncontradaError';
  }
}

// US-102, Cenário 2 [TRAVA O ERRO] — campo obrigatório em branco.
export class CamposObrigatoriosPropostaError extends Error {
  constructor() {
    super(
      'Operação Rejeitada: Os campos Tipo, Nome/Objeto, Data de Início, Data de Término e Categoria são obrigatórios e não podem ser nulos.',
    );
    this.name = 'CamposObrigatoriosPropostaError';
  }
}

// US-102, Cenário 3 [TRAVA O ERRO] — Data de Término <= Data de Início.
export class DatasPropostaInvalidasError extends Error {
  constructor() {
    super(
      'Erro de Validação: A Data de Término não pode ser inferior ou igual à Data de Início configurada para o Termo de Parceria.',
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
      'Ação Negada: Esta Proposta está oficializada e seus dados fiscais estão congelados. Nenhuma alteração é permitida.',
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

// US-120/ADR-034 — bloqueio de negócio ao tentar restaurar a versão que já é a vigente
// (nada a fazer; validado no backend, não só desabilitado na UI).
export class VersaoJaVigenteError extends Error {
  constructor(motivo: string = 'Esta já é a versão vigente.') {
    super(motivo);
    this.name = 'VersaoJaVigenteError';
  }
}

// US-003, Cenário 2, RN_PLA_005 — natureza da conta filha deve ser consistente com a
// hierarquia; regra simétrica (bloqueia OPEX sob ancestral CAPEX e vice-versa).
export class NaturezaHierarquiaInvalidaError extends Error {
  constructor(public readonly naturezaAncestral: 'OPEX' | 'CAPEX', public readonly naturezaTentativa: 'OPEX' | 'CAPEX') {
    super(
      `Classificação Inválida: A conta sintética pai desta conta está classificada como ${naturezaAncestral}. Não é permitido classificar uma conta filha como ${naturezaTentativa} — a natureza deve ser consistente com a hierarquia.`,
    );
    this.name = 'NaturezaHierarquiaInvalidaError';
  }
}

// US-107 — campos obrigatórios do Cargo (Cargo Mercado, faixa de mercado, fonte ativa, período).
export class CamposObrigatoriosCargoError extends Error {
  constructor() {
    super('Preencha todos os campos obrigatórios do cargo antes de salvar.');
    this.name = 'CamposObrigatoriosCargoError';
  }
}

// US-107, Cenário 2, RN_CAR_01 [TRAVA O ERRO] — cargo não pode ser salvo sem vínculo funcional.
export class VinculoFuncionalObrigatorioError extends Error {
  constructor() {
    super('Selecione um vínculo funcional (nó Analítico) antes de salvar o cargo.');
    this.name = 'VinculoFuncionalObrigatorioError';
  }
}

// US-107, Cenário 3 [TRAVA O ERRO] — vínculo só é aceito com nó Analítico (Assessor/Coordenadoria/Setor).
export class VinculoCargoNaoAnaliticoError extends Error {
  constructor() {
    super('Cargo só pode ser vinculado a um nó Analítico (Assessor, Coordenadoria ou Setor).');
    this.name = 'VinculoCargoNaoAnaliticoError';
  }
}

// US-107 — UnidadeFuncional referenciada não existe (ou não pertence ao tenant/Proposta).
export class UnidadeFuncionalNaoEncontradaError extends Error {
  constructor() {
    super('Unidade funcional não encontrada.');
    this.name = 'UnidadeFuncionalNaoEncontradaError';
  }
}

// ADR-043 — RN_EST_03 ("regra dos 100%", SomaAlocacaoCargoInvalidaError) removida:
// reverteu ADR-026 (rateio percentual N:M), vínculo Cargo-UnidadeFuncional voltou a ser
// 1:1 (RN_CAR_08). Nenhum outro módulo dependia dessa regra.

// US-107 — Cargo referenciado não existe (ou não pertence ao tenant).
export class CargoNaoEncontradoError extends Error {
  constructor() {
    super('Cargo não encontrado.');
    this.name = 'CargoNaoEncontradoError';
  }
}

// US-107 — geração automática do código do Cargo esgotou as tentativas de retry.
export class CodigoCargoGeracaoFalhouError extends Error {
  constructor() {
    super('Não foi possível gerar um código único para o Cargo. Tente novamente.');
    this.name = 'CodigoCargoGeracaoFalhouError';
  }
}

// US-112 — Proposta não tem categoria=POR_META; Meta não se aplica.
export class MetaForaDeEscopoCategoriaError extends Error {
  constructor() {
    super("Metas só são aplicáveis a Propostas com categoria 'Por Meta'.");
    this.name = 'MetaForaDeEscopoCategoriaError';
  }
}

// US-112, Cenário 2 — Meta é 1:1 opcional por Versão; não pode haver uma segunda.
export class MetaJaExistenteError extends Error {
  constructor() {
    super('Esta Versão já possui uma Meta cadastrada. Altere o registro existente em vez de criar um novo.');
    this.name = 'MetaJaExistenteError';
  }
}

// US-112 — Meta referenciada não existe (ou não pertence ao tenant).
export class MetaNaoEncontradaError extends Error {
  constructor() {
    super('Meta não encontrada.');
    this.name = 'MetaNaoEncontradaError';
  }
}

// US-112, RN0139 — campos obrigatórios do cadastro/alteração de Meta.
export class CamposObrigatoriosMetaError extends Error {
  constructor() {
    super('Preencha Tipo e Status antes de salvar.');
    this.name = 'CamposObrigatoriosMetaError';
  }
}

// US-108, RN0248 — Cargo é obrigatório no cadastro do Empregado.
export class CargoObrigatorioEmpregadoError extends Error {
  constructor() {
    super('Selecione um Cargo antes de salvar o empregado.');
    this.name = 'CargoObrigatorioEmpregadoError';
  }
}

// US-108 — Empregado só é aceito em Proposta categoria=CONSOLIDADA nesta US.
export class EmpregadoForaDeEscopoCategoriaError extends Error {
  constructor() {
    super('Empregados de Propostas por Meta ainda não são suportados — aguarde a implementação do módulo de Metas.');
    this.name = 'EmpregadoForaDeEscopoCategoriaError';
  }
}

// US-108, RN0252 — Período Inicial não pode ser anterior à data de início da Proposta.
export class PeriodoInicialRetroativoError extends Error {
  constructor() {
    super('Período Inicial não pode ser anterior à data de início da Proposta.');
    this.name = 'PeriodoInicialRetroativoError';
  }
}

// US-108b — quantidade do lançamento em lote deve ser um inteiro maior que zero.
export class QuantidadeEmpregadoLoteInvalidaError extends Error {
  constructor() {
    super('Informe uma quantidade inteira maior que zero.');
    this.name = 'QuantidadeEmpregadoLoteInvalidaError';
  }
}

// US-108 — Empregado referenciado não existe (ou não pertence ao tenant).
export class EmpregadoNaoEncontradoError extends Error {
  constructor() {
    super('Empregado não encontrado.');
    this.name = 'EmpregadoNaoEncontradoError';
  }
}

// US-108, Cargo referenciado no cadastro/edição de Empregado não existe.
export class CargoNaoEncontradoParaEmpregadoError extends Error {
  constructor() {
    super('Cargo não encontrado.');
    this.name = 'CargoNaoEncontradoParaEmpregadoError';
  }
}

// US-107a, Cenário 3 — percentual de Encargos Sociais fora da faixa 0-100.
export class EncargosSociaisPercentualInvalidoError extends Error {
  constructor() {
    super('Percentual de Encargos Sociais deve estar entre 0 e 100.');
    this.name = 'EncargosSociaisPercentualInvalidoError';
  }
}

// US-107a, Cenário 4 — valor de benefício negativo.
export class ValorBeneficioNegativoError extends Error {
  constructor() {
    super('Valores de benefícios não podem ser negativos.');
    this.name = 'ValorBeneficioNegativoError';
  }
}

// ADR-044/US-136 — Ativo=true exige Tipo preenchido (Periculosidade ou Insalubridade).
export class TipoValorAdicionalObrigatorioError extends Error {
  constructor(campo: 'Periculosidade' | 'Insalubridade') {
    super(`Tipo de valor de ${campo} é obrigatório quando ativo.`);
    this.name = 'TipoValorAdicionalObrigatorioError';
  }
}

// ADR-044/US-136, Cenário 3 — Tipo=PERCENTUAL exige Valor entre 0 e 100.
export class PercentualValorAdicionalInvalidoError extends Error {
  constructor(campo: 'Periculosidade' | 'Insalubridade') {
    super(`Percentual de ${campo} deve estar entre 0 e 100.`);
    this.name = 'PercentualValorAdicionalInvalidoError';
  }
}

// ADR-044/US-136, Cenário 4 — valor negativo em qualquer tipo (percentual ou valor fixo).
export class ValorAdicionalNegativoError extends Error {
  constructor() {
    super('Valores de Periculosidade/Insalubridade não podem ser negativos.');
    this.name = 'ValorAdicionalNegativoError';
  }
}

// US-108a, Cenário 2 — elegibilidade só é aceita para benefício ativo no Cargo do Empregado.
export class BeneficioIndisponivelNoCargoError extends Error {
  constructor() {
    super('Este benefício não está disponível no Cargo deste empregado.');
    this.name = 'BeneficioIndisponivelNoCargoError';
  }
}

// US-108a, Cenário 3, RN0252 — vigência do benefício fora do período da Proposta.
export class VigenciaBeneficioForaDaPropostaError extends Error {
  constructor() {
    super('Período do benefício não pode extrapolar a vigência da Proposta.');
    this.name = 'VigenciaBeneficioForaDaPropostaError';
  }
}

// US-108a, Cenário 4, RN0253 — período/dependentes obrigatórios (exceto Vale Transporte).
export class CamposObrigatoriosBeneficioError extends Error {
  constructor() {
    super('Período de vigência e Nº de Dependentes são obrigatórios para este benefício.');
    this.name = 'CamposObrigatoriosBeneficioError';
  }
}


// US-109, Cenário 3 — conta referenciada (passagem/diária/transporte) não é analítica.
export class ContaViagemNaoAnaliticaError extends Error {
  constructor() {
    super('Selecione uma conta analítica (nível folha) para passagem, diária e transporte.');
    this.name = 'ContaViagemNaoAnaliticaError';
  }
}

// US-109 — campos obrigatórios do cadastro/alteração de Viagem.
// US-141 — "Descrição" (agora "Motivo/Complemento") deixou de ser obrigatória.
export class CamposObrigatoriosViagemError extends Error {
  constructor() {
    super('Preencha Quantidade de Pessoas, Média de Dias e os custos/contas de passagem, diária e transporte.');
    this.name = 'CamposObrigatoriosViagemError';
  }
}

// US-141 — município é obrigatório no cadastro de nova Viagem (regra de aplicação; a coluna é nullable no banco).
export class MunicipioViagemObrigatorioError extends Error {
  constructor() {
    super('Selecione o município de destino da viagem.');
    this.name = 'MunicipioViagemObrigatorioError';
  }
}

// US-141 — código IBGE informado não existe no catálogo embutido de municípios.
export class MunicipioNaoEncontradoError extends Error {
  constructor() {
    super('Município não encontrado no catálogo.');
    this.name = 'MunicipioNaoEncontradoError';
  }
}

// US-109 — Viagem referenciada não existe (ou não pertence ao tenant).
export class ViagemNaoEncontradaError extends Error {
  constructor() {
    super('Viagem não encontrada.');
    this.name = 'ViagemNaoEncontradaError';
  }
}

// US-109, Cenário 5 — exclusão bloqueada quando a Proposta já foi enviada para aprovação.
export class ViagemPropostaEmAprovacaoError extends Error {
  constructor() {
    super('Não é possível excluir viagem de Proposta em aprovação.');
    this.name = 'ViagemPropostaEmAprovacaoError';
  }
}

// US-110, Cenário 2 — metaId é obrigatório apenas quando Proposta.categoria=POR_META.
export class MetaObrigatoriaItemPatrimonialError extends Error {
  constructor() {
    super('Meta é obrigatória para Propostas por Meta.');
    this.name = 'MetaObrigatoriaItemPatrimonialError';
  }
}

// US-110, Cenário 4 — campos obrigatórios do cadastro/alteração de Item Patrimonial.
export class CamposObrigatoriosItemPatrimonialError extends Error {
  constructor() {
    super('Descrição, Data, Quantidade e Conta Analítica são obrigatórios.');
    this.name = 'CamposObrigatoriosItemPatrimonialError';
  }
}

// US-110, Cenário 5 — quantidade <= 0 ou valor unitário negativo.
export class QuantidadeOuValorItemPatrimonialInvalidoError extends Error {
  constructor() {
    super('Quantidade deve ser maior que zero e Valor Unitário não pode ser negativo.');
    this.name = 'QuantidadeOuValorItemPatrimonialInvalidoError';
  }
}

// US-110 — conta referenciada não é analítica (isAnalitica=false).
export class ContaItemPatrimonialNaoAnaliticaError extends Error {
  constructor() {
    super('Selecione uma conta analítica (nível folha) para o item patrimonial.');
    this.name = 'ContaItemPatrimonialNaoAnaliticaError';
  }
}

// US-110 — Item Patrimonial referenciado não existe (ou não pertence ao tenant).
export class ItemPatrimonialNaoEncontradoError extends Error {
  constructor() {
    super('Item patrimonial não encontrado.');
    this.name = 'ItemPatrimonialNaoEncontradoError';
  }
}

// US-113, Cenário 4, RN0153 — campos obrigatórios do cadastro/alteração de Qtde. Empregado.
export class CamposObrigatoriosQtdeEmpregadoError extends Error {
  constructor() {
    super('Período Inicial e Período Final são obrigatórios.');
    this.name = 'CamposObrigatoriosQtdeEmpregadoError';
  }
}

// US-113 — geração automática do Número do Documento (formato "C-XXX") esgotou as tentativas de retry.
export class NumeroDocumentoGeracaoFalhouError extends Error {
  constructor() {
    super('Não foi possível gerar um Número do Documento único. Tente novamente.');
    this.name = 'NumeroDocumentoGeracaoFalhouError';
  }
}

// US-113, Cenário 2, RN0154 — período extrapola a vigência da Proposta.
export class PeriodoQtdeEmpregadoForaDaVigenciaError extends Error {
  constructor() {
    super('Período não pode extrapolar a vigência da Proposta.');
    this.name = 'PeriodoQtdeEmpregadoForaDaVigenciaError';
  }
}

// US-113, Cenário 3, RN0155 — sobreposição de período de consolidação na mesma Proposta.
export class SobreposicaoPeriodoQtdeEmpregadoError extends Error {
  constructor() {
    super('Já existe um período de consolidação sobreposto para esta Proposta.');
    this.name = 'SobreposicaoPeriodoQtdeEmpregadoError';
  }
}

// US-113, Cenário 6, RN0159 — edição/exclusão só permitida com Proposta em RASCUNHO/EM_ELABORACAO.
export class QtdeEmpregadoPropostaImutavelError extends Error {
  constructor() {
    super('Não é possível alterar Qtde. Empregado de Proposta homologada ou fechada.');
    this.name = 'QtdeEmpregadoPropostaImutavelError';
  }
}

// US-113 — Qtde. Empregado referenciada não existe (ou não pertence ao tenant).
export class QtdeEmpregadoNaoEncontradaError extends Error {
  constructor() {
    super('Registro de Qtde. Empregado não encontrado.');
    this.name = 'QtdeEmpregadoNaoEncontradaError';
  }
}

// US-111, RN de origem/destino [TRAVA O ERRO] — conta sintética não recebe/cede ajuste.
export class TermoAjusteContaNaoAnaliticaError extends Error {
  constructor() {
    super('Selecione contas analíticas (nível folha) de origem e destino para o ajuste.');
    this.name = 'TermoAjusteContaNaoAnaliticaError';
  }
}

// US-111 — origem e destino não podem ser a mesma conta.
export class TermoAjusteMesmaContaError extends Error {
  constructor() {
    super('Conta de origem e conta de destino não podem ser a mesma.');
    this.name = 'TermoAjusteMesmaContaError';
  }
}

// US-111, Cenário 2 [TRAVA O ERRO] — saldo da conta de origem insuficiente para o ajuste.
export class TermoAjusteSaldoInsuficienteError extends Error {
  constructor() {
    super('Saldo insuficiente na conta de origem para o ajuste solicitado.');
    this.name = 'TermoAjusteSaldoInsuficienteError';
  }
}

// US-111, Cenário 3 [TRAVA O ERRO] — RN0139-equivalente: homologação não pode alterar o valor global da Proposta.
export class TermoAjusteInvarianciaValorGlobalError extends Error {
  constructor() {
    super('Ajuste não preserva o valor global da Proposta.');
    this.name = 'TermoAjusteInvarianciaValorGlobalError';
  }
}

// US-111 — valor do ajuste deve ser positivo.
export class TermoAjusteValorInvalidoError extends Error {
  constructor() {
    super('Valor Inválido: informe um valor de ajuste maior que zero.');
    this.name = 'TermoAjusteValorInvalidoError';
  }
}

// US-111 — Termo de Ajuste referenciado não existe (ou não pertence ao tenant).
export class TermoAjusteNaoEncontradoError extends Error {
  constructor() {
    super('Termo de Ajuste não encontrado.');
    this.name = 'TermoAjusteNaoEncontradoError';
  }
}

// US-111, Cenário 4 [TRAVA O ERRO] — transição de status fora da ordem definida (N1 -> Gestor Master -> Homologado).
export class TermoAjusteEstadoInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'TermoAjusteEstadoInvalidoError';
  }
}

// US-111, Cenário 6 [TRAVA O ERRO] — usuário sem PerfilFuncionalidade de aprovação N1.
export class TermoAjusteAcessoNegadoN1Error extends Error {
  constructor() {
    super('Perfil sem permissão para aprovar Termo de Ajuste (1º nível).');
    this.name = 'TermoAjusteAcessoNegadoN1Error';
  }
}

// US-111, Cenário 6 [TRAVA O ERRO] — usuário sem PerfilFuncionalidade de homologação do Gestor Master.
export class TermoAjusteAcessoNegadoGestorMasterError extends Error {
  constructor() {
    super('Perfil sem permissão para homologar Termo de Ajuste (Gestor Master).');
    this.name = 'TermoAjusteAcessoNegadoGestorMasterError';
  }
}


// ADR-027 — Cargo precisa de uma ContaContabil analítica (natureza da despesa,
// ex: "Despesa com Pessoal"), independente do rateio percentual entre
// UnidadeFuncional (organograma, ADR-026 — dimensões independentes).
export class ContaCargoNaoAnaliticaError extends Error {
  constructor() {
    super('Selecione uma conta analítica (nível folha) para o cargo.');
    this.name = 'ContaCargoNaoAnaliticaError';
  }
}

// ADR-029 — conta de um componente de custo do Cargo (gratificação, encargos,
// cada benefício) precisa existir, pertencer ao tenant e ser analítica.
export class ContaComponenteCustoNaoAnaliticaError extends Error {
  constructor(componente: string) {
    super(`Selecione uma conta analítica (nível folha) para ${componente}.`);
    this.name = 'ContaComponenteCustoNaoAnaliticaError';
  }
}

// ADR-031, mesmo padrão de InativacaoUnidadeFuncionalBloqueadaError (US-106) —
// Cargo com Empregado ativo vinculado não pode ser excluído.
export class ExclusaoCargoBloqueadaError extends Error {
  constructor(public readonly codigosCargosBloqueados: string[]) {
    super(
      `Exclusão Bloqueada: ${
        codigosCargosBloqueados.length === 1
          ? `O cargo "${codigosCargosBloqueados[0]}" possui`
          : `Os cargos ${codigosCargosBloqueados.join(', ')} possuem`
      } empregados vinculados. Exclua ou realoque os empregados antes de excluir o(s) cargo(s).`,
    );
    this.name = 'ExclusaoCargoBloqueadaError';
  }
}

// ADR-027 — Rateio de Impostos precisa de uma ContaContabil analítica por linha.
export class ContaRateioImpostoNaoAnaliticaError extends Error {
  constructor() {
    super('Selecione uma conta analítica (nível folha) para o rateio de imposto.');
    this.name = 'ContaRateioImpostoNaoAnaliticaError';
  }
}

// US-144/ADR-050 Frente B — contaId do rateio precisa existir e pertencer ao tenant
// (analítica OU sintética, a partir da US-145). Sucede ContaRateioImpostoNaoAnaliticaError.
export class ContaRateioImpostoInvalidaError extends Error {
  constructor() {
    super('Conta do rateio de imposto não encontrada ou inativa.');
    this.name = 'ContaRateioImpostoInvalidaError';
  }
}

// US-144, Cenário 8 — nenhum custo cadastrado ou nenhum tributo vinculado à Versão.
export class SemBaseParaGerarImpostosError extends Error {
  constructor() {
    super('Cadastre custos e vincule ao menos um tributo antes de gerar impostos.');
    this.name = 'SemBaseParaGerarImpostosError';
  }
}

// UC03.39-42 — CRUD de AliquotaImpostoParametro (Central de Alíquotas de Impostos).

// UC03.40/41, RN_IMP_005 — nome único (case-insensitive) na base de parâmetros fiscais.
export class AliquotaImpostoNomeDuplicadoError extends Error {
  constructor(nome: string) {
    super(`Operação Rejeitada: Já existe uma alíquota cadastrada com o nome ${nome}. Utilize um nome único.`);
    this.name = 'AliquotaImpostoNomeDuplicadoError';
  }
}

// UC03.40/41, RN_IMP_006 — 0,00% <= alíquota <= 100,00%.
export class AliquotaImpostoForaDaFaixaError extends Error {
  constructor() {
    super('Alíquota Inválida: O valor deve estar entre 0,00% e 100,00%.');
    this.name = 'AliquotaImpostoForaDaFaixaError';
  }
}

// UC03.40/41, RN_IMP_006/RN_TAX_01 — ISS (case-insensitive) deve estar entre 2,00% e 5,00% (LC 116/2003).
export class AliquotaImpostoIssForaDaFaixaLegalError extends Error {
  constructor() {
    super('Alíquota de ISS Inválida: A alíquota de ISS deve estar entre 2,00% e 5,00% conforme a LC 116/2003.');
    this.name = 'AliquotaImpostoIssForaDaFaixaLegalError';
  }
}

// UC03.40/41, RN_IMP_007 — Data de Início da Vigência não pode ser retroativa.
export class AliquotaImpostoDataInicioRetroativaError extends Error {
  constructor() {
    super('Data Inválida: A data de início da vigência não pode ser retroativa à data atual.');
    this.name = 'AliquotaImpostoDataInicioRetroativaError';
  }
}

// UC03.40/41 — Data de Fim, se informada, deve ser posterior à Data de Início.
export class AliquotaImpostoDataFimInvalidaError extends Error {
  constructor() {
    super('Data Inválida: A data de fim da vigência deve ser posterior à data de início.');
    this.name = 'AliquotaImpostoDataFimInvalidaError';
  }
}

// UC03.39/40/41/42 — parâmetro não encontrado para o tenant (edição/exclusão de registro inexistente).
export class AliquotaImpostoParametroNaoEncontradaError extends Error {
  constructor() {
    super('Alíquota de imposto não encontrada.');
    this.name = 'AliquotaImpostoParametroNaoEncontradaError';
  }
}

// UC03.42, RN_IMP_009 [TRAVA O ERRO] — exclusão bloqueada por referência ativa em Proposta não congelada.
export class AliquotaImpostoReferenciadaError extends Error {
  constructor() {
    super(
      'Exclusão Bloqueada: Esta alíquota está sendo utilizada em Propostas ativas. Remova as referências antes de excluir.',
    );
    this.name = 'AliquotaImpostoReferenciadaError';
  }
}

// ADR-038 (revisão) — contaSinteticaId, quando informado, deve apontar para uma conta
// existente do tenant (sintética ou analítica) — é apenas um valor padrão para o rateio.
export class ContaSugeridaAliquotaImpostoNaoEncontradaError extends Error {
  constructor() {
    super('A conta sugerida não foi encontrada.');
    this.name = 'ContaSugeridaAliquotaImpostoNaoEncontradaError';
  }
}

// US-129 — escopo (Agrupador) do reajuste em lote não existe (ou não pertence ao tenant).
export class AgrupadorReajusteNaoEncontradoError extends Error {
  constructor() {
    super('Agrupador não encontrado.');
    this.name = 'AgrupadorReajusteNaoEncontradoError';
  }
}

// US-129, Cenário 9/10 — escopo do reajuste não resolveu em nenhuma conta analítica.
export class EscopoReajusteVazioError extends Error {
  constructor() {
    super('Nenhuma conta analítica encontrada para o escopo selecionado. Verifique o filtro e tente novamente.');
    this.name = 'EscopoReajusteVazioError';
  }
}

// US-130, Cenário 7 — Proposta origem não tem nenhuma UnidadeFuncional ativa para importar.
export class EstruturaOrigemVaziaError extends Error {
  constructor() {
    super('A Proposta de origem não tem Estrutura Organizacional cadastrada para importar.');
    this.name = 'EstruturaOrigemVaziaError';
  }
}

// US-130, Cenário 4 [TRAVA O ERRO] — ADR-041: checagem em lote (não reaproveita RN_EST_04
// unidade-a-unidade) — bloqueia a importação inteira antes de qualquer escrita se a Proposta
// destino tiver Cargo vinculado a unidades que seriam substituídas.
export class ImportacaoEstruturaBloqueadaPorCargoVinculadoError extends Error {
  constructor(nomesUnidades: string[]) {
    super(
      `Importação Bloqueada: as seguintes unidades da Proposta destino têm Cargo vinculado e não podem ser substituídas: ${nomesUnidades.join(', ')}. Remova ou realoque os cargos antes de importar.`,
    );
    this.name = 'ImportacaoEstruturaBloqueadaPorCargoVinculadoError';
  }
}

// US-131 — UC03.19, seção 5. Tabela Salarial de mercado (por Cargo + Senioridade) e
// catálogo de Senioridade.

// RN_TAB_02 [TRAVA O ERRO] — Salário Mínimo deve ser estritamente menor que o Máximo.
export class SalarioMinimoMaiorIgualMaximoError extends Error {
  constructor() {
    super('Salário Mínimo deve ser menor que o Salário Máximo.');
    this.name = 'SalarioMinimoMaiorIgualMaximoError';
  }
}

// RN_TAB_01 [TRAVA O ERRO] — Jr/Pl/Sr nascem protegidas (isPadrao=true), nunca excluíveis.
export class SenioridadePadraoNaoExcluivelError extends Error {
  constructor() {
    super('Esta Senioridade é um nível padrão do sistema e não pode ser excluída.');
    this.name = 'SenioridadePadraoNaoExcluivelError';
  }
}

// RN_TAB_01 [TRAVA O ERRO] — Senioridade customizada só é excluível sem registro vinculado.
export class SenioridadeReferenciadaError extends Error {
  constructor() {
    super('Esta Senioridade possui registros na Tabela Salarial e não pode ser excluída.');
    this.name = 'SenioridadeReferenciadaError';
  }
}

// Nome de Senioridade único por tenant (case-insensitive).
export class SenioridadeNomeDuplicadoError extends Error {
  constructor(descricao: string) {
    super(`Já existe uma Senioridade cadastrada com o nome "${descricao}". Utilize um nome único.`);
    this.name = 'SenioridadeNomeDuplicadoError';
  }
}

export class SenioridadeNaoEncontradaError extends Error {
  constructor() {
    super('Senioridade não encontrada.');
    this.name = 'SenioridadeNaoEncontradaError';
  }
}

export class TabelaSalarialNaoEncontradaError extends Error {
  constructor() {
    super('Registro da Tabela Salarial não encontrado.');
    this.name = 'TabelaSalarialNaoEncontradaError';
  }
}

// ADR-042 — Cargo Rascunho (cadastro só com nome, aba Tabela Salarial) não tem
// Vínculo Funcional/Conta/salário definidos ainda; não pode receber Empregado.
export class CargoRascunhoNaoPodeReceberEmpregadoError extends Error {
  constructor() {
    super(
      'Este Cargo está incompleto (Rascunho). Complete o cadastro na aba Cargos (Vínculo Funcional, Conta, Salário) antes de vincular Empregados.',
    );
    this.name = 'CargoRascunhoNaoPodeReceberEmpregadoError';
  }
}

// US-138 (relatório de Cronograma de Desembolso) Cenário 8 — trava de erro: falha ao
// gravar a trilha de auditoria bloqueia a geração/liberação do arquivo exportado.
export class FalhaAuditoriaExportacaoRelatorioError extends Error {
  constructor() {
    super(
      'Ação Abortada: Falha crítica na geração da trilha de auditoria compulsória. A extração de dados foi suspensa para garantir a conformidade de auditoria.',
    );
    this.name = 'FalhaAuditoriaExportacaoRelatorioError';
  }
}

// US-142/ADR-049 — calendário de repasse da Proposta inválido. Os dois campos
// (parcelasPorAno, mesInicialRepasse) andam juntos; parcelasPorAno ∈ {1,2,3,4,6,12};
// mesInicialRepasse 1..12.
export class CalendarioRepasseInvalidoError extends Error {
  constructor(
    motivo = 'Calendário de repasse inválido: informe Parcelas por Ano (1, 2, 3, 4, 6 ou 12) e Mês Inicial do Repasse (1 a 12) juntos, ou deixe ambos em branco.',
  ) {
    super(motivo);
    this.name = 'CalendarioRepasseInvalidoError';
  }
}

// US-138 Cenário 6 — trava de erro: Termo de Parceria/Proposta não selecionado.
export class RelatorioCronogramaDesembolsoSemPropostaError extends Error {
  constructor() {
    super('Operação Rejeitada: A seleção de um Termo de Parceria Oficializado é obrigatória para a abertura do cronograma de desembolso.');
    this.name = 'RelatorioCronogramaDesembolsoSemPropostaError';
  }
}
