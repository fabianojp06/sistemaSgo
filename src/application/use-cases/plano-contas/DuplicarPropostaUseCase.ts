import type { PrismaClient, Proposta, VersaoProposta } from '@prisma/client';
import {
  CodigoPropostaGeracaoFalhouError,
  DatasPropostaInvalidasError,
  PropostaNaoEncontradaError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';
import { gerarProximoCodigoProposta, isUniqueConstraintError } from '@/domain/plano-contas/gerarCodigoProposta';

const MAX_TENTATIVAS_CODIGO = 5;

type DuplicarPropostaInput = {
  tenantId: string;
  usuarioId: string;
  propostaOrigemId: string;
  nome?: string;
  dataInicio?: Date;
  dataFim?: Date;
};

type DuplicarPropostaResult = Proposta & { versaoInicial: VersaoProposta };

/**
 * US-104 — Duplicar Proposta. Cria uma Proposta nova e independente (novo
 * codigo, sempre RASCUNHO/Versão 1 — RN_DUP_005), copiando ValorOrcadoConta e
 * RateioImpostoGrade (ativos) da versão vigente da origem. A origem permanece
 * intacta (RN_DUP_006); Valor Global nunca é copiado, sempre recalculado
 * (RN_DUP_007) — nesta camada isso significa simplesmente não copiar nenhum
 * campo de total, só os lançamentos-fonte.
 */
export class DuplicarPropostaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: DuplicarPropostaInput): Promise<DuplicarPropostaResult> {
    const origem = await this.prisma.proposta.findFirst({
      where: { tenantId: input.tenantId, id: input.propostaOrigemId },
    });
    if (!origem) {
      throw new PropostaNaoEncontradaError();
    }

    const versaoOrigem = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, propostaId: origem.id, vigente: true, ativa: true },
    });
    if (!versaoOrigem) {
      throw new VersaoPropostaInvalidaError('Proposta de origem não possui versão vigente para duplicar.');
    }

    const dataInicio = input.dataInicio ?? origem.dataInicio;
    const dataFim = input.dataFim ?? origem.dataFim;
    if (dataFim.getTime() <= dataInicio.getTime()) {
      throw new DatasPropostaInvalidasError();
    }

    // RN_DUP_002 — prefixo automático, mas o campo continua obrigatório e editável.
    const nome = input.nome?.trim() || `Cópia de ${origem.nome}`;

    const ano = new Date().getFullYear();

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS_CODIGO; tentativa++) {
      const codigo = await gerarProximoCodigoProposta(this.prisma, input.tenantId, ano);

      try {
        return await this.prisma.$transaction(async (tx) => {
          const novaProposta = await tx.proposta.create({
            data: {
              tenantId: input.tenantId,
              codigo,
              nome,
              tipo: origem.tipo,
              categoria: origem.categoria,
              dataInicio,
              dataFim,
              status: 'RASCUNHO',
              // US-142/ADR-049 — o calendário de repasse é um parâmetro da Proposta,
              // faz parte da configuração; a cópia leva junto.
              parcelasPorAno: origem.parcelasPorAno,
              mesInicialRepasse: origem.mesInicialRepasse,
            },
          });

          const novaVersao = await tx.versaoProposta.create({
            data: {
              tenantId: input.tenantId,
              propostaId: novaProposta.id,
              numeroVersao: 1,
              status: 'RASCUNHO',
              vigente: true,
              createdBy: input.usuarioId,
            },
          });

          const valoresOrigem = await tx.valorOrcadoConta.findMany({
            where: { tenantId: input.tenantId, versaoId: versaoOrigem.id },
          });
          if (valoresOrigem.length > 0) {
            await tx.valorOrcadoConta.createMany({
              data: valoresOrigem.map((v) => ({
                tenantId: input.tenantId,
                versaoId: novaVersao.id,
                contaId: v.contaId,
                exercicio: v.exercicio,
                valor: v.valor,
              })),
            });
          }

          // Só linhas ativas — o soft delete (Cenário 3 da US-101) não deve "ressuscitar" na cópia.
          const rateiosOrigem = await tx.rateioImpostoGrade.findMany({
            where: { tenantId: input.tenantId, versaoId: versaoOrigem.id, ativo: true },
          });
          if (rateiosOrigem.length > 0) {
            await tx.rateioImpostoGrade.createMany({
              data: rateiosOrigem.map((r) => ({
                tenantId: input.tenantId,
                versaoId: novaVersao.id,
                aliquotaParametroId: r.aliquotaParametroId,
                contaId: r.contaId,
                competencia: r.competencia,
                valorDeclarado: r.valorDeclarado,
                aliquotaAplicadaSnapshot: r.aliquotaAplicadaSnapshot,
                ativo: true,
              })),
            });
          }

          await tx.historicoOperacao.create({
            data: {
              tenantId: input.tenantId,
              usuarioId: input.usuarioId,
              tipoOperacao: 'PROPOSTA_DUPLICADA',
              descricao: `Proposta "${origem.codigo}" duplicada para "${codigo}"`,
              dadosSerializados: {
                propostaOrigemId: origem.id,
                propostaNovaId: novaProposta.id,
                versaoOrigemId: versaoOrigem.id,
                versaoNovaId: novaVersao.id,
                valoresOrcadosCopiados: valoresOrigem.length,
                rateiosImpostoCopiados: rateiosOrigem.length,
              },
            },
          });

          return { ...novaProposta, versaoInicial: novaVersao };
        });
      } catch (erro) {
        if (isUniqueConstraintError(erro)) continue;
        throw erro;
      }
    }

    throw new CodigoPropostaGeracaoFalhouError();
  }
}
