import type { PrismaClient } from '@prisma/client';
import { CalendarioRepasseInvalidoError, PropostaImutavelError, PropostaNaoEncontradaError } from '@/domain/plano-contas/errors';
import { podeEditarVersao } from '@/domain/plano-contas/podeEditarVersao';
import { validarCalendarioRepasse } from '@/domain/plano-contas/gerarDatasParcela';

type EditarCalendarioRepasseInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  parcelasPorAno: number | null;
  mesInicialRepasse: number | null;
};

/**
 * US-142/ADR-049 — edita o calendário de repasse na capa da Proposta (mini-form).
 * Só permitido enquanto a Versão vigente está em RASCUNHO/EM_ELABORACAO
 * (mesma trava de escrita das demais guias — `podeEditarVersao`).
 */
export class EditarCalendarioRepassePropostaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: EditarCalendarioRepasseInput): Promise<void> {
    const proposta = await this.prisma.proposta.findFirst({
      where: { tenantId: input.tenantId, id: input.propostaId },
      select: { id: true, codigo: true, nome: true, parcelasPorAno: true, mesInicialRepasse: true },
    });
    if (!proposta) throw new PropostaNaoEncontradaError();

    const versaoVigente = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, propostaId: proposta.id, vigente: true, ativa: true },
      select: { status: true },
    });
    if (!versaoVigente || !podeEditarVersao(versaoVigente.status)) {
      throw new PropostaImutavelError();
    }

    let calendario: { parcelasPorAno: number | null; mesInicialRepasse: number | null };
    try {
      calendario = validarCalendarioRepasse(input.parcelasPorAno, input.mesInicialRepasse);
    } catch (erro) {
      throw new CalendarioRepasseInvalidoError(erro instanceof Error ? erro.message : undefined);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.proposta.update({
        where: { id: proposta.id },
        data: {
          parcelasPorAno: calendario.parcelasPorAno,
          mesInicialRepasse: calendario.mesInicialRepasse,
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'CALENDARIO_REPASSE_PROPOSTA_EDITADO',
          descricao: `Calendário de repasse da Proposta "${proposta.codigo} — ${proposta.nome}" atualizado`,
          dadosSerializados: {
            propostaId: proposta.id,
            de: { parcelasPorAno: proposta.parcelasPorAno, mesInicialRepasse: proposta.mesInicialRepasse },
            para: calendario,
          },
        },
      });
    });
  }
}
