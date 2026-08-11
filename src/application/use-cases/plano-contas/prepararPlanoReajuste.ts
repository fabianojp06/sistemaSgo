import { type Prisma, type PrismaClient } from '@prisma/client';
import {
  AgrupadorReajusteNaoEncontradoError,
  AliquotaImpostoNaoEncontradaError,
  ContaRateioImpostoNaoAnaliticaError,
  EscopoReajusteVazioError,
  ImpostoNaoDisponivelParaTipoPropostaError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';
import { hojeNoFusoDoSistema } from '@/domain/shared/dataCalendario';
import { calcularPlanoReajusteConta, gerarCompetencias, type PlanoReajusteConta } from '@/domain/plano-contas/calcularReajusteLote';
import type { EscopoReajuste } from './reajusteLoteTipos';

export type PrepararPlanoReajusteInput = {
  tenantId: string;
  versaoId: string;
  aliquotaParametroId: string;
  escopo: EscopoReajuste;
};

export type PlanoReajusteLote = {
  aliquotaParametro: {
    id: string;
    nome: string;
    aliquotaPct: Prisma.Decimal;
    periodicidadeReajuste: import('@prisma/client').PeriodicidadeReajuste;
  };
  versaoId: string;
  statusVersaoNoMomento: string;
  planos: PlanoReajusteConta[];
};

/**
 * US-129/UC04.02 [ADR-040] — monta o plano de reajuste (cascata + retroatividade),
 * sem gravar nada. Reaproveitado por SimularReajusteUseCase (preview) e
 * AplicarReajusteUseCase (persistência), garantindo que ambos calculem exatamente
 * a mesma coisa.
 *
 * Cenário 8 — decisão do usuário: roda em QUALQUER status de Proposta/Versão, sem
 * bloqueio (substitui a RN_PR_003 original do CA, ainda pendente de validação
 * formal por André/SCOR na cadeia de aceite).
 */
export async function prepararPlanoReajuste(prisma: PrismaClient, input: PrepararPlanoReajusteInput): Promise<PlanoReajusteLote> {
  const versao = await prisma.versaoProposta.findFirst({
    where: { tenantId: input.tenantId, id: input.versaoId, ativa: true },
    include: { proposta: true },
  });
  if (!versao) {
    throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
  }

  const aliquotaParametro = await prisma.aliquotaImpostoParametro.findFirst({
    where: { tenantId: input.tenantId, id: input.aliquotaParametroId },
  });
  if (!aliquotaParametro) {
    throw new AliquotaImpostoNaoEncontradaError();
  }

  // RN_PRO_010 — mesma imunidade tributária de US-101: Termo de Parceria não aceita
  // índice CONTRATO-only.
  if (versao.proposta.tipo === 'TERMO_DE_PARCERIA' && aliquotaParametro.tipoIncidencia === 'CONTRATO') {
    throw new ImpostoNaoDisponivelParaTipoPropostaError();
  }

  const contaIds = await resolverEscopo(prisma, input.tenantId, input.versaoId, input.escopo);
  if (contaIds.length === 0) {
    throw new EscopoReajusteVazioError();
  }

  const contasAnaliticas = await prisma.contaContabil.findMany({
    where: { tenantId: input.tenantId, id: { in: contaIds }, isAnalitica: true },
    select: { id: true },
  });
  if (contasAnaliticas.length === 0) {
    throw new EscopoReajusteVazioError();
  }
  const contasValidasIds = contasAnaliticas.map((c) => c.id);

  const inicioJanela =
    aliquotaParametro.dataInicioVigencia.getTime() > versao.proposta.dataInicio.getTime()
      ? aliquotaParametro.dataInicioVigencia
      : versao.proposta.dataInicio;
  const fimJanela =
    aliquotaParametro.dataFimVigencia && aliquotaParametro.dataFimVigencia.getTime() < versao.proposta.dataFim.getTime()
      ? aliquotaParametro.dataFimVigencia
      : versao.proposta.dataFim;
  const competencias = inicioJanela.getTime() <= fimJanela.getTime() ? gerarCompetencias(inicioJanela, fimJanela) : [];

  const [anoCorrente, mesCorrente] = hojeNoFusoDoSistema().split('-').map(Number);
  const competenciaCorrente = new Date(Date.UTC(anoCorrente, mesCorrente - 1, 1));

  const linhasExistentes = await prisma.rateioImpostoGrade.findMany({
    where: {
      tenantId: input.tenantId,
      versaoId: input.versaoId,
      aliquotaParametroId: input.aliquotaParametroId,
      contaId: { in: contasValidasIds },
    },
    orderBy: { competencia: 'asc' },
  });
  const linhasPorConta = new Map<string, typeof linhasExistentes>();
  for (const linha of linhasExistentes) {
    const lista = linhasPorConta.get(linha.contaId) ?? [];
    lista.push(linha);
    linhasPorConta.set(linha.contaId, lista);
  }

  const planos = contasValidasIds.map((contaId) =>
    calcularPlanoReajusteConta({
      contaId,
      linhasExistentes: linhasPorConta.get(contaId) ?? [],
      aliquotaNova: aliquotaParametro.aliquotaPct,
      competencias,
      competenciaCorrente,
      periodicidadeMeses: MESES_POR_PERIODICIDADE[aliquotaParametro.periodicidadeReajuste],
      ancoraVigencia: aliquotaParametro.dataInicioVigencia,
    }),
  );

  return {
    aliquotaParametro: {
      id: aliquotaParametro.id,
      nome: aliquotaParametro.nome,
      aliquotaPct: aliquotaParametro.aliquotaPct,
      periodicidadeReajuste: aliquotaParametro.periodicidadeReajuste,
    },
    versaoId: input.versaoId,
    statusVersaoNoMomento: versao.status,
    planos,
  };
}

const MESES_POR_PERIODICIDADE: Record<import('@prisma/client').PeriodicidadeReajuste, number> = {
  MENSAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

async function resolverEscopo(prisma: PrismaClient, tenantId: string, versaoId: string, escopo: EscopoReajuste): Promise<string[]> {
  if (escopo.modo === 'CONTA') {
    const conta = await prisma.contaContabil.findFirst({
      where: { tenantId, id: escopo.contaId },
      select: { id: true, isAnalitica: true },
    });
    if (!conta?.isAnalitica) {
      throw new ContaRateioImpostoNaoAnaliticaError();
    }
    return [conta.id];
  }

  if (escopo.modo === 'AGRUPADOR') {
    const agrupador = await prisma.contaAgrupadora.findFirst({ where: { tenantId, id: escopo.agrupadorId }, select: { id: true } });
    if (!agrupador) {
      throw new AgrupadorReajusteNaoEncontradoError();
    }
    const itens = await prisma.contaAgrupadoraItem.findMany({ where: { agrupadoraId: agrupador.id }, select: { contaId: true } });
    return itens.map((i) => i.contaId);
  }

  // RN_PR_005 — Categoria nula aplica globalmente: toda conta analítica desta versão
  // que já tem algum rateio de imposto/índice parametrizado.
  const rateios = await prisma.rateioImpostoGrade.findMany({
    where: { tenantId, versaoId },
    select: { contaId: true },
    distinct: ['contaId'],
  });
  return [...new Set(rateios.map((r) => r.contaId))];
}
