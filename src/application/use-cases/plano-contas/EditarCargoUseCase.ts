import type { Cargo, FonteAtivaSalario, OrigemSalarioMercado, PrismaClient } from '@prisma/client';
import {
  CamposObrigatoriosCargoError,
  CargoNaoEncontradoError,
  ContaCargoNaoAnaliticaError,
  SomaAlocacaoCargoInvalidaError,
  UnidadeFuncionalNaoEncontradaError,
  VinculoCargoNaoAnaliticoError,
  VinculoFuncionalObrigatorioError,
} from '@/domain/plano-contas/errors';
import { calcularSalarioTotalCargo } from '@/domain/plano-contas/calcularSalarioTotalCargo';
import { validarContasComponenteCusto } from '@/domain/plano-contas/validarContasComponenteCusto';

const TIPOS_ANALITICOS = ['ANALITICO_ASSESSOR', 'ANALITICO_COORDENADORIA', 'ANALITICO_SETOR'];

type AlocacaoInput = { unidadeFuncionalId: string; percentual: number };

type EditarCargoInput = {
  tenantId: string;
  usuarioId: string;
  cargoId: string;
  /** ADR-026, RN_EST_03 — substitui integralmente o rateio anterior (não é diff incremental). */
  alocacoes: AlocacaoInput[];
  /** ADR-027 — natureza da despesa (ex: "Despesa com Pessoal"); 1 conta analítica fixa por Cargo. */
  contaId: string;
  nomeCargoMercado: string;
  funcaoGratificada?: number | null;
  /** ADR-029 — conta analítica da Função Gratificada; null se o campo não estiver preenchido. */
  contaGratificacaoId?: string | null;
  periodoInicio: Date;
  salarioMercadoMinimo: number;
  salarioMercadoMaximo: number;
  /** US-133, RN_TAB_04/05 — origem de cada campo (Tabela Salarial ou digitado manualmente). */
  origemSalarioMinimo?: OrigemSalarioMercado;
  origemSalarioMaximo?: OrigemSalarioMercado;
  fonteAtiva: FonteAtivaSalario;
  /**
   * Cenário 4 [TRAVA O ERRO / RN_CAR_03] — mesmo que o client envie um valor
   * para "Salário Real (Rubi)", ele é ignorado silenciosamente: o campo é
   * soberano do provider Rubi e nunca é aceito como input de edição.
   */
  salarioReal?: number | null;
};

/** US-107 — Editar Cargo (blocos A e B do UC03.19). Não altera o Salário Real. */
export class EditarCargoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: EditarCargoInput): Promise<Cargo> {
    const nome = input.nomeCargoMercado?.trim() ?? '';
    if (
      nome.length === 0 ||
      !input.periodoInicio ||
      input.salarioMercadoMinimo === undefined ||
      input.salarioMercadoMaximo === undefined ||
      !input.fonteAtiva
    ) {
      throw new CamposObrigatoriosCargoError();
    }

    if (!input.alocacoes || input.alocacoes.length === 0) {
      throw new VinculoFuncionalObrigatorioError();
    }

    const somaPercentual = input.alocacoes.reduce((soma, a) => soma + a.percentual, 0);
    if (Math.abs(somaPercentual - 100) > 0.01) {
      throw new SomaAlocacaoCargoInvalidaError();
    }

    const cargoAtual = await this.prisma.cargo.findFirst({
      where: { tenantId: input.tenantId, id: input.cargoId },
    });
    if (!cargoAtual) {
      throw new CargoNaoEncontradoError();
    }

    const unidades = await this.prisma.unidadeFuncional.findMany({
      where: { tenantId: input.tenantId, id: { in: input.alocacoes.map((a) => a.unidadeFuncionalId) }, propostaId: cargoAtual.propostaId },
    });
    const unidadesPorId = new Map(unidades.map((u) => [u.id, u]));
    for (const alocacao of input.alocacoes) {
      const unidade = unidadesPorId.get(alocacao.unidadeFuncionalId);
      if (!unidade) {
        throw new UnidadeFuncionalNaoEncontradaError();
      }
      if (!TIPOS_ANALITICOS.includes(unidade.tipoNivel)) {
        throw new VinculoCargoNaoAnaliticoError();
      }
    }

    // ADR-027 [TRAVA O ERRO] — conta precisa existir, pertencer ao tenant e ser analítica.
    const conta = await this.prisma.contaContabil.findFirst({
      where: { tenantId: input.tenantId, id: input.contaId },
      select: { isAnalitica: true },
    });
    if (!conta?.isAnalitica) {
      throw new ContaCargoNaoAnaliticaError();
    }

    // ADR-029 [TRAVA O ERRO] — conta da Função Gratificada, se informada, precisa ser analítica.
    await validarContasComponenteCusto(this.prisma, input.tenantId, {
      gratificacao: { id: input.contaGratificacaoId ?? null, label: 'Função Gratificada' },
    });

    // Cenário 4 — salarioReal do input é sempre descartado; usa-se o valor já
    // persistido (soberano do provider Rubi).
    const salarioTotal = calcularSalarioTotalCargo({
      fonteAtiva: input.fonteAtiva,
      salarioMercadoMinimo: input.salarioMercadoMinimo,
      salarioMercadoMaximo: input.salarioMercadoMaximo,
      salarioReal: cargoAtual.salarioReal,
      funcaoGratificada: input.funcaoGratificada ?? null,
    });

    return this.prisma.$transaction(async (tx) => {
      const cargo = await tx.cargo.update({
        where: { id: input.cargoId },
        data: {
          nomeCargoMercado: nome,
          contaId: input.contaId,
          funcaoGratificada: input.funcaoGratificada ?? null,
          contaGratificacaoId: input.contaGratificacaoId ?? null,
          periodoInicio: input.periodoInicio,
          salarioMercadoMinimo: input.salarioMercadoMinimo,
          salarioMercadoMaximo: input.salarioMercadoMaximo,
          // Sem input explícito, preserva a origem já persistida — só o client sabe se o
          // valor mudou desde o último carregamento (edição manual muda a origem lá).
          origemSalarioMinimo: input.origemSalarioMinimo ?? cargoAtual.origemSalarioMinimo,
          origemSalarioMaximo: input.origemSalarioMaximo ?? cargoAtual.origemSalarioMaximo,
          fonteAtiva: input.fonteAtiva,
          salarioTotal,
          // salarioReal/statusSyncSalario/syncedAt propositalmente ausentes daqui.
        },
      });

      // Substituição atômica do rateio inteiro — mais simples/seguro que diff
      // incremental para um array pequeno de N unidades (ADR-026).
      await tx.cargoAlocacaoPercentual.deleteMany({ where: { tenantId: input.tenantId, cargoId: input.cargoId } });
      await tx.cargoAlocacaoPercentual.createMany({
        data: input.alocacoes.map((a) => ({
          tenantId: input.tenantId,
          cargoId: input.cargoId,
          unidadeFuncionalId: a.unidadeFuncionalId,
          percentual: a.percentual,
        })),
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'CARGO_EDITADO',
          descricao: `Cargo "${cargoAtual.codigoCargo} — ${nome}" editado`,
          dadosSerializados: {
            cargoId: cargo.id,
            alocacoes: input.alocacoes,
            fonteAtiva: input.fonteAtiva,
            salarioTotal: salarioTotal.toString(),
          },
        },
      });

      return cargo;
    });
  }
}
