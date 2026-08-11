import { Prisma, type PrismaClient } from '@prisma/client';
import { VersaoOficializadaCongeladaError, ValorOrcadoInvalidoError } from '@/domain/plano-contas/errors';
import { prepararPlanoReajuste, type PlanoReajusteLote, type PrepararPlanoReajusteInput } from './prepararPlanoReajuste';

type AplicarReajusteInput = PrepararPlanoReajusteInput & { usuarioId: string };

/**
 * US-129, Cenários 8 (revisado 2026-08-11), 10-14 — Confirmar Reajuste em Lote.
 * Protocolo Transacional: todo o lote (RateioImpostoGrade + ValorOrcadoConta de
 * todas as contas, o ajuste retroativo e o log delta) roda dentro de 1 único
 * prisma.$transaction() — se qualquer escrita falhar, tudo sofre rollback e
 * nenhum log é gravado (RNF_PR_001/002, Cenário 14). RN_PR_006 — Half-Even já
 * aplicado no motor de cálculo, antes de abrir a transação.
 *
 * [Revisão 2026-08-11] Cenário 8 original ("roda em qualquer status") foi
 * REVERTIDO em teste manual: gravar em ValorOrcadoConta de uma Versão
 * Oficializada/Encerrada violaria a mesma trava de congelamento do US-007
 * (ConfigurarValorOrcadoContaUseCase) — decisão do usuário foi manter essa
 * trava também aqui, em vez de abrir uma exceção. Só RASCUNHO/EM_ELABORACAO.
 */
export class AplicarReajusteUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: AplicarReajusteInput): Promise<PlanoReajusteLote> {
    const plano = await prepararPlanoReajuste(this.prisma, input);
    if (plano.statusVersaoNoMomento !== 'RASCUNHO' && plano.statusVersaoNoMomento !== 'EM_ELABORACAO') {
      throw new VersaoOficializadaCongeladaError();
    }

    return this.prisma.$transaction(
      async (tx) => {
        for (const contaPlano of plano.planos) {
          for (const linha of contaPlano.linhasFuturas) {
            const chave = {
              tenantId: input.tenantId,
              versaoId: input.versaoId,
              aliquotaParametroId: input.aliquotaParametroId,
              contaId: contaPlano.contaId,
              competencia: linha.competencia,
            };
            // [ultrareview 2026-08-11] Uma linha soft-deletada (ADR-014) ocupa a
            // mesma chave única — se existir, o reajuste em lote não escreve nada
            // ali (nem reativa, nem sobrescreve o valor congelado no momento da
            // desativação). `prepararPlanoReajuste` já filtra `ativo:true` na
            // leitura, então o motor de cálculo nem sabe que essa linha existe;
            // sem este guard, o upsert a encontraria pela chave e sobrescreveria
            // valorDeclarado mesmo com a linha continuando ativo:false.
            const linhaInativa = await tx.rateioImpostoGrade.findUnique({
              where: { tenantId_versaoId_aliquotaParametroId_contaId_competencia: chave },
              select: { ativo: true },
            });
            if (linhaInativa?.ativo === false) continue;

            await tx.rateioImpostoGrade.upsert({
              where: { tenantId_versaoId_aliquotaParametroId_contaId_competencia: chave },
              // valorDeclarado no update é simétrico ao create e ao ramo retroativo
              // — antes faltava aqui, o que divergia o preview do persistido e
              // quebrava idempotência (rerun recomputava o mesmo crescimento sobre
              // o valor antigo, nunca atualizado).
              update: { valorDeclarado: linha.valorNovo, aliquotaAplicadaSnapshot: linha.aliquotaNova },
              create: {
                ...chave,
                valorDeclarado: linha.valorNovo,
                aliquotaAplicadaSnapshot: linha.aliquotaNova,
                ativo: true,
              },
            });
          }

          if (contaPlano.ajusteRetroativo) {
            const ajuste = contaPlano.ajusteRetroativo;
            const chave = {
              tenantId: input.tenantId,
              versaoId: input.versaoId,
              aliquotaParametroId: input.aliquotaParametroId,
              contaId: contaPlano.contaId,
              competencia: ajuste.competenciaAjuste,
            };
            const linhaInativa = await tx.rateioImpostoGrade.findUnique({
              where: { tenantId_versaoId_aliquotaParametroId_contaId_competencia: chave },
              select: { ativo: true },
            });
            if (linhaInativa?.ativo !== false) {
              await tx.rateioImpostoGrade.upsert({
                where: { tenantId_versaoId_aliquotaParametroId_contaId_competencia: chave },
                update: { valorDeclarado: ajuste.valorFinal, aliquotaAplicadaSnapshot: plano.aliquotaParametro.aliquotaPct },
                create: {
                  ...chave,
                  valorDeclarado: ajuste.valorFinal,
                  aliquotaAplicadaSnapshot: plano.aliquotaParametro.aliquotaPct,
                  ativo: true,
                },
              });
            }
          }

          // [Revisão 2026-08-11] Efeito monetário do reajuste precisa aparecer no
          // Valor Orçado, não só na memória de cálculo do Rateio de Impostos —
          // gap encontrado em teste manual (dissídio sobre Salário não refletia).
          for (const { exercicio, delta } of contaPlano.deltasValorOrcadoPorExercicio) {
            const existente = await tx.valorOrcadoConta.findUnique({
              where: { tenantId_versaoId_contaId_exercicio: { tenantId: input.tenantId, versaoId: input.versaoId, contaId: contaPlano.contaId, exercicio } },
            });
            const valorFinal = (existente?.valor ?? new Prisma.Decimal(0)).plus(delta);
            if (valorFinal.isNegative()) {
              throw new ValorOrcadoInvalidoError();
            }
            if (existente) {
              await tx.valorOrcadoConta.update({ where: { id: existente.id }, data: { valor: valorFinal } });
            } else {
              await tx.valorOrcadoConta.create({
                data: { tenantId: input.tenantId, versaoId: input.versaoId, contaId: contaPlano.contaId, exercicio, valor: valorFinal },
              });
            }
          }
        }

        // RN_PR_004 — log delta com IDs, valor antes/depois e status da Proposta
        // no momento (Cenário 8), sempre na mesma transação do lote.
        await tx.historicoOperacao.create({
          data: {
            tenantId: input.tenantId,
            usuarioId: input.usuarioId,
            tipoOperacao: 'REAJUSTE_LOTE_APLICADO',
            descricao: `Reajuste em lote aplicado com o índice "${plano.aliquotaParametro.nome}" sobre ${plano.planos.length} conta(s) analítica(s)`,
            dadosSerializados: {
              versaoId: input.versaoId,
              aliquotaParametroId: input.aliquotaParametroId,
              aliquotaAplicadaPct: plano.aliquotaParametro.aliquotaPct.toString(),
              statusPropostaNoMomento: plano.statusVersaoNoMomento,
              contas: plano.planos.map((p) => ({
                contaId: p.contaId,
                linhasFuturas: p.linhasFuturas.map((l) => ({
                  competencia: l.competencia,
                  valorAnterior: l.valorAnterior?.toString() ?? null,
                  valorNovo: l.valorNovo.toString(),
                  aliquotaAnterior: l.aliquotaAnterior?.toString() ?? null,
                  aliquotaNova: l.aliquotaNova.toString(),
                })),
                ajusteRetroativo: p.ajusteRetroativo
                  ? {
                      competencia: p.ajusteRetroativo.competenciaAjuste,
                      valorAjuste: p.ajusteRetroativo.valorAjuste.toString(),
                      valorFinal: p.ajusteRetroativo.valorFinal.toString(),
                      mesesAfetados: p.ajusteRetroativo.mesesAfetados,
                    }
                  : null,
                deltasValorOrcado: p.deltasValorOrcadoPorExercicio.map((d) => ({ exercicio: d.exercicio, delta: d.delta.toString() })),
              })),
            },
          },
        });

        return plano;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        // Cada linha (conta x competência) é 1 upsert sequencial — com várias
        // contas/meses e latência de rede até o banco, o timeout padrão de
        // transação interativa do Prisma (5s) estourava antes de terminar,
        // encerrando a transação no meio (Cenário 14 cobre o rollback correto
        // quando isso acontece; aqui só damos mais tempo pro caso comum).
        maxWait: 10_000,
        timeout: 30_000,
      },
    );
  }
}
