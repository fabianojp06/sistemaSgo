import type { ContaContabil, PrismaClient } from '@prisma/client';
import {
  SemaforoContaSinteticaError,
  SemaforoLimiarAmareloInvalidoError,
  SemaforoLimiarLaranjaInvalidoError,
  SemaforoPercentualForaDaFaixaError,
} from '@/domain/plano-contas/errors';

type Limiares = { verde: number; amarelo: number; laranja: number } | null;

type ConfigurarSemaforoContaInput = {
  tenantId: string;
  usuarioId: string;
  contaId: string;
  limiares: Limiares;
};

/** US-008 — Configurar Semáforo Orçamentário por Conta Analítica [RN_PLA_006]. */
export class ConfigurarSemaforoContaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ConfigurarSemaforoContaInput): Promise<ContaContabil> {
    const conta = await this.prisma.contaContabil.findFirstOrThrow({
      where: { id: input.contaId, tenantId: input.tenantId },
    });

    // Cenário 3 — seletor só existe para contas analíticas (nó folha).
    if (!conta.isAnalitica) {
      throw new SemaforoContaSinteticaError();
    }

    if (input.limiares !== null) {
      this.validarCoerencia(input.limiares);
    }

    const limiaresAnteriores = {
      verde: conta.semaforoVerdePct,
      amarelo: conta.semaforoAmareloPct,
      laranja: conta.semaforoLaranjaPct,
    };

    const [contaAtualizada] = await this.prisma.$transaction([
      this.prisma.contaContabil.update({
        where: { id: conta.id },
        data: {
          semaforoVerdePct: input.limiares?.verde ?? null,
          semaforoAmareloPct: input.limiares?.amarelo ?? null,
          semaforoLaranjaPct: input.limiares?.laranja ?? null,
        },
      }),
      this.prisma.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'SEMAFORO_CONFIGURADO',
          descricao: `Limiares do Semáforo Orçamentário da conta "${conta.codigoErp} — ${conta.nomeConta}" configurados`,
          dadosSerializados: {
            contaId: conta.id,
            limiaresAnteriores,
            limiaresNovos: input.limiares,
          },
        },
      }),
    ]);

    return contaAtualizada;
  }

  // Cenários 2, 2a, 2b — coerência entre faixas e limite legal 1-100.
  private validarCoerencia(limiares: { verde: number; amarelo: number; laranja: number }): void {
    const { verde, amarelo, laranja } = limiares;

    if (verde <= 0 || verde > 100 || amarelo <= 0 || amarelo > 100 || laranja <= 0 || laranja > 100) {
      throw new SemaforoPercentualForaDaFaixaError();
    }
    if (amarelo <= verde) {
      throw new SemaforoLimiarAmareloInvalidoError();
    }
    if (laranja <= amarelo) {
      throw new SemaforoLimiarLaranjaInvalidoError();
    }
  }
}
