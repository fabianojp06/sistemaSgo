import type { PrismaClient, VersaoProposta } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { VersaoPropostaInvalidaError } from '@/domain/plano-contas/errors';

type CriarVersaoPropostaInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  descricao?: string;
};

/**
 * US-007, Cenário 4 (extendido pela US-119/ADR-033) — nova versão de uma
 * Proposta nasce copiando os dados da versão de origem (vigente), que
 * permanece intacta e consultável no histórico.
 *
 * Regras de cópia por tabela filha, decididas em ADR-033:
 * - Meta: 1:1 por versão. valorGlobal NUNCA é copiado literal — é recalculado
 *   como SUM dos ValorOrcadoConta recém-inseridos na nova versão (mesma regra
 *   de espelho da US-112), para não herdar um valor potencialmente
 *   desalinhado da origem.
 * - Viagem/ItemPatrimonial: copiados com metaId apontando para a Meta nova
 *   (não a antiga), quando a Meta foi copiada.
 * - TermoAjuste: copia apenas status HOMOLOGADO (fluxo final). Termos em
 *   PENDENTE_APROVACAO_N1/PENDENTE_APROVACAO_GESTOR_MASTER/REJEITADO ficam
 *   só na versão antiga — aprovação pendente não faz sentido "herdada" para
 *   uma versão que ainda não existia quando foi solicitada.
 */
export class CriarVersaoPropostaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CriarVersaoPropostaInput): Promise<VersaoProposta> {
    const versaoOrigem = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, propostaId: input.propostaId, vigente: true, ativa: true },
    });
    if (!versaoOrigem) {
      throw new VersaoPropostaInvalidaError('Proposta não possui versão vigente para servir de origem.');
    }

    const [valoresOrigem, rateiosOrigem, metaOrigem, viagensOrigem, itensOrigem, termosOrigem] = await Promise.all([
      this.prisma.valorOrcadoConta.findMany({ where: { tenantId: input.tenantId, versaoId: versaoOrigem.id } }),
      this.prisma.rateioImpostoGrade.findMany({ where: { tenantId: input.tenantId, versaoId: versaoOrigem.id, ativo: true } }),
      this.prisma.meta.findFirst({ where: { tenantId: input.tenantId, versaoId: versaoOrigem.id, ativo: true } }),
      this.prisma.viagem.findMany({ where: { tenantId: input.tenantId, versaoId: versaoOrigem.id, ativo: true } }),
      this.prisma.itemPatrimonial.findMany({ where: { tenantId: input.tenantId, versaoId: versaoOrigem.id, ativo: true } }),
      this.prisma.termoAjuste.findMany({ where: { tenantId: input.tenantId, versaoId: versaoOrigem.id, status: 'HOMOLOGADO' } }),
    ]);

    return this.prisma.$transaction(async (tx) => {
      await tx.versaoProposta.update({
        where: { id: versaoOrigem.id },
        data: { vigente: false },
      });

      const novaVersao = await tx.versaoProposta.create({
        data: {
          tenantId: input.tenantId,
          propostaId: input.propostaId,
          numeroVersao: versaoOrigem.numeroVersao + 1,
          descricao: input.descricao,
          status: 'RASCUNHO',
          vigente: true,
          createdBy: input.usuarioId,
        },
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
          })),
        });
      }

      let metaNovaId: string | null = null;
      if (metaOrigem) {
        const valorGlobalRecalculado = valoresOrigem.reduce(
          (soma, v) => soma.add(v.valor),
          new Prisma.Decimal(0),
        );

        const metaNova = await tx.meta.create({
          data: {
            tenantId: input.tenantId,
            versaoId: novaVersao.id,
            tipo: metaOrigem.tipo,
            nome: metaOrigem.nome,
            valorGlobal: valorGlobalRecalculado,
            status: metaOrigem.status,
            observacao: metaOrigem.observacao,
          },
        });
        metaNovaId = metaNova.id;
      }

      if (viagensOrigem.length > 0) {
        await tx.viagem.createMany({
          data: viagensOrigem.map((v) => ({
            tenantId: input.tenantId,
            versaoId: novaVersao.id,
            metaId: v.metaId ? metaNovaId : null,
            descricao: v.descricao,
            quantidadePessoas: v.quantidadePessoas,
            mediaDias: v.mediaDias,
            custoUnitarioPassagem: v.custoUnitarioPassagem,
            contaPassagemId: v.contaPassagemId,
            custoUnitarioDiaria: v.custoUnitarioDiaria,
            contaDiariaId: v.contaDiariaId,
            custoUnitarioTransporte: v.custoUnitarioTransporte,
            contaTransporteId: v.contaTransporteId,
            custoEstimado: v.custoEstimado,
          })),
        });
      }

      if (itensOrigem.length > 0) {
        await tx.itemPatrimonial.createMany({
          data: itensOrigem.map((i) => ({
            tenantId: input.tenantId,
            versaoId: novaVersao.id,
            metaId: i.metaId ? metaNovaId : null,
            contaId: i.contaId,
            descricao: i.descricao,
            data: i.data,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
            valorTotal: i.valorTotal,
          })),
        });
      }

      if (termosOrigem.length > 0) {
        await tx.termoAjuste.createMany({
          data: termosOrigem.map((t) => ({
            tenantId: input.tenantId,
            versaoId: novaVersao.id,
            contaOrigemId: t.contaOrigemId,
            contaDestinoId: t.contaDestinoId,
            exercicio: t.exercicio,
            valor: t.valor,
            status: t.status,
            createdBy: input.usuarioId,
          })),
        });
      }

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'VERSAO_PROPOSTA_CRIADA',
          descricao: `Versão ${novaVersao.numeroVersao} criada a partir da versão ${versaoOrigem.numeroVersao}`,
          dadosSerializados: {
            propostaId: input.propostaId,
            versaoOrigemId: versaoOrigem.id,
            versaoNovaId: novaVersao.id,
            valoresCopiados: valoresOrigem.length,
            rateiosCopiados: rateiosOrigem.length,
            metaCopiada: metaOrigem !== null,
            viagensCopiadas: viagensOrigem.length,
            itensPatrimoniaisCopiados: itensOrigem.length,
            termosAjusteCopiados: termosOrigem.length,
          },
        },
      });

      return novaVersao;
    });
  }
}
