import { Prisma, type PrismaClient, type TipoIncidenciaImposto } from '@prisma/client';
import { hojeNoFusoDoSistema } from '@/domain/shared/dataCalendario';

export type BlocoPremissa = 'CONTRATOS' | 'PARCERIA_ACT';

export type CelulaPremissa =
  | { competencia: Date; tag: 'REALIZADO' }
  | { competencia: Date; tag: 'PROJETADO'; aliquotaPct: Prisma.Decimal }
  | { competencia: Date; tag: 'SEM_INDICE' };

export type LinhaPremissaReajuste = {
  contaId: string;
  /** [Code review 2026-08-10] Uma linha por (conta, bloco) — não por conta sozinha. Uma
   * conta com histórico em CONTRATO e TERMO_DE_PARCERIA (percentuais/vigências distintos
   * por natureza) gera 2 linhas, cada uma com suas próprias células, nunca a mesma célula
   * repetida nos 2 blocos. Sem nenhum rateio cadastrado, gera 1 linha em CONTRATOS
   * (convenção pragmática — o documento-fonte não especifica bloco para conta zerada). */
  bloco: BlocoPremissa;
  /** RN0383 — false quando a conta não tem nenhum AliquotaImpostoParametro vinculado
   * (via RateioImpostoGrade); usado pelo filtro "Exibir Contas Zeradas" na UI. */
  temIndice: boolean;
  celulas: CelulaPremissa[];
};

type PeriodoVigencia = { dataInicio: Date; dataFim: Date };
type ParametroConta = { id: string; tipoIncidencia: TipoIncidenciaImposto; aliquotaPct: Prisma.Decimal; dataInicioVigencia: Date; dataFimVigencia: Date | null };

function primeiroDiaDoMes(ano: number, mesIndex0: number): Date {
  return new Date(Date.UTC(ano, mesIndex0, 1));
}

function pertenceAoBloco(tipo: TipoIncidenciaImposto, bloco: BlocoPremissa): boolean {
  if (bloco === 'CONTRATOS') return tipo === 'CONTRATO' || tipo === 'AMBOS';
  return tipo === 'TERMO_DE_PARCERIA' || tipo === 'AMBOS';
}

/**
 * US-128/UC04.02 [ADR-040] — Relatório de Premissas / Aplicações de Reajuste.
 *
 * "Formula" do documento-fonte é reaproveitada de `AliquotaImpostoParametro`/
 * `RateioImpostoGrade` (Rateio de Impostos, US-101/ADR-027/ADR-038) — decisão do
 * usuário, sem entidade nova. Algoritmo de projeção (ADR-040, Decisão 1): para
 * cada conta analítica, cada bloco (RN0239) e cada mês da vigência da Proposta,
 * busca entre os `AliquotaImpostoParametro` daquele bloco já vinculados àquela
 * conta (via qualquer `RateioImpostoGrade.aliquotaParametroId` histórico) o de
 * vigência mais recente cuja janela cobre o mês. Mês <= mês corrente (fuso do
 * sistema) sempre marca "Realizado", independente de achar parâmetro (RN0225).
 * Mês futuro sem nenhum parâmetro cobrindo vira "SEM_INDICE" — sem herança entre
 * reajustes sucessivos.
 *
 * [Code review 2026-08-10] Antes, uma única série de células era computada por
 * conta e reaproveitada nos 2 blocos — uma conta com parâmetros distintos de
 * CONTRATO e TERMO_DE_PARCERIA mostrava a mesma projeção (errada para um dos
 * dois) nos 2 blocos. Agora cada (conta, bloco) filtra só os parâmetros daquele
 * tipo antes de projetar, e o `orderBy` na query + desempate por vigência mais
 * recente tornam a escolha determinística quando há janelas sobrepostas.
 */
export class ListarPremissasReajusteUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    tenantId: string,
    usuarioId: string,
    versaoId: string,
    contaIds: string[],
    periodo: PeriodoVigencia,
  ): Promise<LinhaPremissaReajuste[]> {
    if (contaIds.length === 0) return [];

    const rateios = await this.prisma.rateioImpostoGrade.findMany({
      where: { tenantId, versaoId, contaId: { in: contaIds }, ativo: true },
      select: {
        contaId: true,
        aliquotaParametro: {
          select: { id: true, tipoIncidencia: true, aliquotaPct: true, dataInicioVigencia: true, dataFimVigencia: true },
        },
      },
      // Determinismo — ordem estável de desempate quando há vigências sobrepostas do mesmo tipo.
      orderBy: { aliquotaParametro: { dataInicioVigencia: 'asc' } },
    });

    // Cenário 6 — proposta sem nenhum rateio cadastrado é "resultado vazio": não loga (RN0232).
    if (rateios.length === 0) return [];

    const parametrosPorConta = new Map<string, Map<string, ParametroConta>>();
    for (const rateio of rateios) {
      const porId = parametrosPorConta.get(rateio.contaId) ?? new Map();
      porId.set(rateio.aliquotaParametro.id, rateio.aliquotaParametro);
      parametrosPorConta.set(rateio.contaId, porId);
    }

    const meses: Date[] = [];
    let cursor = primeiroDiaDoMes(periodo.dataInicio.getUTCFullYear(), periodo.dataInicio.getUTCMonth());
    const limite = primeiroDiaDoMes(periodo.dataFim.getUTCFullYear(), periodo.dataFim.getUTCMonth());
    while (cursor.getTime() <= limite.getTime()) {
      meses.push(cursor);
      cursor = primeiroDiaDoMes(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1);
    }

    const [anoCorrente, mesCorrente] = hojeNoFusoDoSistema().split('-').map(Number);
    const competenciaCorrente = primeiroDiaDoMes(anoCorrente, mesCorrente - 1);

    const linhas: LinhaPremissaReajuste[] = [];
    for (const contaId of contaIds) {
      const parametros = [...(parametrosPorConta.get(contaId)?.values() ?? [])];
      const temIndice = parametros.length > 0;
      const tiposIncidencia = new Set(parametros.map((p) => p.tipoIncidencia));
      const blocos = this.determinarBlocos(tiposIncidencia);

      for (const bloco of blocos) {
        const parametrosDoBloco = parametros.filter((p) => pertenceAoBloco(p.tipoIncidencia, bloco));

        const celulas: CelulaPremissa[] = meses.map((competencia) => {
          if (competencia.getTime() <= competenciaCorrente.getTime()) {
            return { competencia, tag: 'REALIZADO' };
          }
          const vigentes = parametrosDoBloco.filter(
            (p) =>
              p.dataInicioVigencia.getTime() <= competencia.getTime() &&
              (p.dataFimVigencia === null || p.dataFimVigencia.getTime() >= competencia.getTime()),
          );
          // Desempate determinístico: entre parâmetros com janela sobreposta cobrindo o
          // mesmo mês, vale o de vigência mais recente (o reajuste negociado por último).
          const vigente = vigentes.reduce<ParametroConta | null>(
            (mais, atual) => (mais === null || atual.dataInicioVigencia.getTime() > mais.dataInicioVigencia.getTime() ? atual : mais),
            null,
          );
          return vigente ? { competencia, tag: 'PROJETADO', aliquotaPct: vigente.aliquotaPct } : { competencia, tag: 'SEM_INDICE' };
        });

        linhas.push({ contaId, bloco, temIndice, celulas });
      }
    }

    // RN0232 — log síncrono só quando há resultado (rateios.length > 0, checado acima).
    await this.prisma.historicoOperacao.create({
      data: {
        tenantId,
        usuarioId,
        tipoOperacao: 'PREMISSA_REAJUSTE_CONSULTADA',
        descricao: `Consulta ao relatório de Premissas / Aplicações de Reajuste da versão ${versaoId}`,
        dadosSerializados: { versaoId, contaIds },
      },
    });

    return linhas;
  }

  private determinarBlocos(tipos: Set<TipoIncidenciaImposto>): BlocoPremissa[] {
    if (tipos.size === 0) return ['CONTRATOS'];
    const blocos = new Set<BlocoPremissa>();
    if (tipos.has('CONTRATO') || tipos.has('AMBOS')) blocos.add('CONTRATOS');
    if (tipos.has('TERMO_DE_PARCERIA') || tipos.has('AMBOS')) blocos.add('PARCERIA_ACT');
    return [...blocos];
  }
}
