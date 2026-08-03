import type { EmpregadoBeneficioElegibilidade, PrismaClient, TipoBeneficioElegibilidade } from '@prisma/client';
import {
  BeneficioIndisponivelNoCargoError,
  CamposObrigatoriosBeneficioError,
  EmpregadoNaoEncontradoError,
  VigenciaBeneficioForaDaPropostaError,
} from '@/domain/plano-contas/errors';

type ConfigurarElegibilidadeBeneficioInput = {
  tenantId: string;
  usuarioId: string;
  empregadoId: string;
  tipoBeneficio: TipoBeneficioElegibilidade;
  ativo: boolean;
  periodoInicio?: Date | null;
  periodoFim?: Date | null;
  numeroDependentes?: number;
};

// US-108a — flag correspondente em Cargo para cada TipoBeneficioElegibilidade.
const FLAG_ATIVO_NO_CARGO: Record<TipoBeneficioElegibilidade, string> = {
  VA: 'vaAtivo',
  VR: 'vrAtivo',
  PLANO_SAUDE: 'planoSaudeAtivo',
  PLANO_ODONTO: 'planoOdontoAtivo',
  SEGURO_VIDA: 'seguroVidaAtivo',
  AUXILIO_CRECHE: 'auxilioCrecheAtivo',
  VALE_TRANSPORTE: 'transporteAtivo',
};

/**
 * US-108a — Elegibilidade Individual de Benefícios do Empregado (UC03.28).
 * Valores financeiros nunca são persistidos aqui — são sempre lidos ao vivo
 * do Cargo na leitura (elegibilidade é registro de uso, não histórico de
 * custo, diferente do snapshot de EmpregadoHeadcount.custoTotalMensal).
 */
export class ConfigurarElegibilidadeBeneficioUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ConfigurarElegibilidadeBeneficioInput): Promise<EmpregadoBeneficioElegibilidade> {
    const empregado = await this.prisma.empregadoHeadcount.findFirst({
      where: { tenantId: input.tenantId, id: input.empregadoId, ativo: true },
      include: { cargo: true },
    });
    if (!empregado) {
      throw new EmpregadoNaoEncontradoError();
    }

    const proposta = await this.prisma.proposta.findFirst({ where: { tenantId: input.tenantId, id: empregado.propostaId } });
    if (!proposta) {
      throw new EmpregadoNaoEncontradoError();
    }

    // Cenário 2 — benefício deve estar ativo no Cargo vigente do Empregado.
    const flagCargo = FLAG_ATIVO_NO_CARGO[input.tipoBeneficio] as keyof typeof empregado.cargo;
    if (input.ativo && !empregado.cargo[flagCargo]) {
      throw new BeneficioIndisponivelNoCargoError();
    }

    // Cenário 4, RN0253 — obrigatoriedade de período/dependentes para categoria
    // EMPREGADO em qualquer benefício ativo, exceto Vale Transporte.
    if (input.ativo && empregado.categoria === 'EMPREGADO' && input.tipoBeneficio !== 'VALE_TRANSPORTE') {
      if (!input.periodoInicio || !input.numeroDependentes) {
        throw new CamposObrigatoriosBeneficioError();
      }
    }

    // Cenário 3, RN0252 — vigência dentro do período da Proposta.
    if (input.periodoInicio && input.periodoInicio.getTime() < proposta.dataInicio.getTime()) {
      throw new VigenciaBeneficioForaDaPropostaError();
    }
    if (input.periodoFim && input.periodoFim.getTime() > proposta.dataFim.getTime()) {
      throw new VigenciaBeneficioForaDaPropostaError();
    }

    const existente = await this.prisma.empregadoBeneficioElegibilidade.findUnique({
      where: { tenantId_empregadoId_tipoBeneficio: { tenantId: input.tenantId, empregadoId: input.empregadoId, tipoBeneficio: input.tipoBeneficio } },
    });

    return this.prisma.$transaction(async (tx) => {
      const elegibilidade = await tx.empregadoBeneficioElegibilidade.upsert({
        where: {
          tenantId_empregadoId_tipoBeneficio: {
            tenantId: input.tenantId,
            empregadoId: input.empregadoId,
            tipoBeneficio: input.tipoBeneficio,
          },
        },
        create: {
          tenantId: input.tenantId,
          empregadoId: input.empregadoId,
          tipoBeneficio: input.tipoBeneficio,
          ativo: input.ativo,
          periodoInicio: input.periodoInicio ?? null,
          periodoFim: input.periodoFim ?? null,
          numeroDependentes: input.numeroDependentes ?? 0,
        },
        update: {
          ativo: input.ativo,
          periodoInicio: input.periodoInicio ?? null,
          periodoFim: input.periodoFim ?? null,
          numeroDependentes: input.numeroDependentes ?? 0,
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: existente ? 'BENEFICIO_ELEGIBILIDADE_EDITADA' : 'BENEFICIO_ELEGIBILIDADE_CONFIGURADA',
          descricao: `Elegibilidade de ${input.tipoBeneficio} ${existente ? 'editada' : 'configurada'} para "${empregado.nome}"`,
          dadosSerializados: {
            empregadoId: empregado.id,
            tipoBeneficio: input.tipoBeneficio,
            ativoAnterior: existente?.ativo ?? null,
            ativoNovo: input.ativo,
          },
        },
      });

      return elegibilidade;
    });
  }
}
