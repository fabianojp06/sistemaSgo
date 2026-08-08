import type { PrismaClient } from '@prisma/client';
import { AliquotaImpostoParametroNaoEncontradaError, AliquotaImpostoReferenciadaError } from '@/domain/plano-contas/errors';

type ExcluirAliquotaImpostoInput = {
  tenantId: string;
  usuarioId: string;
  aliquotaImpostoParametroId: string;
};

/**
 * UC03.42 — Excluir (Soft Delete) Alíquota de Imposto. [SOFT DELETE] nunca DELETE físico.
 * RN_IMP_009 [TRAVA O ERRO]: bloqueia se houver RateioImpostoGrade ativo em Proposta não
 * congelada (RASCUNHO/EM_ELABORACAO). Referências em Propostas já Oficializadas (snapshot
 * congelado) NÃO bloqueiam — o snapshot é imutável e independe do parâmetro seguir ativo.
 */
export class ExcluirAliquotaImpostoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ExcluirAliquotaImpostoInput) {
    const atual = await this.prisma.aliquotaImpostoParametro.findFirst({
      where: { tenantId: input.tenantId, id: input.aliquotaImpostoParametroId },
    });
    if (!atual) {
      throw new AliquotaImpostoParametroNaoEncontradaError();
    }

    const referenciaAtiva = await this.prisma.rateioImpostoGrade.findFirst({
      where: {
        tenantId: input.tenantId,
        aliquotaParametroId: atual.id,
        ativo: true,
        versao: { status: { in: ['RASCUNHO', 'EM_ELABORACAO'] } },
      },
      select: { id: true },
    });
    if (referenciaAtiva) {
      throw new AliquotaImpostoReferenciadaError();
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.aliquotaImpostoParametro.update({
        where: { id: atual.id },
        data: { ativo: false, version: { increment: 1 } },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'ALIQUOTA_IMPOSTO_INATIVADA',
          descricao: `Alíquota de imposto "${atual.nome}" inativada`,
          dadosSerializados: {
            aliquotaImpostoParametroId: atual.id,
            estadoAnterior: {
              nome: atual.nome,
              aliquotaPct: atual.aliquotaPct.toString(),
              tipoIncidencia: atual.tipoIncidencia,
              ativo: atual.ativo,
            },
          },
        },
      });

      return { id: atual.id };
    });
  }
}
