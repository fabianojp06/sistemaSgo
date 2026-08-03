import type { Cargo, FonteAtivaSalario, PrismaClient } from '@prisma/client';
import {
  CamposObrigatoriosCargoError,
  CargoNaoEncontradoError,
  UnidadeFuncionalNaoEncontradaError,
  VinculoCargoNaoAnaliticoError,
  VinculoFuncionalObrigatorioError,
} from '@/domain/plano-contas/errors';
import { calcularSalarioTotalCargo } from '@/domain/plano-contas/calcularSalarioTotalCargo';

const TIPOS_ANALITICOS = ['ANALITICO_ASSESSOR', 'ANALITICO_COORDENADORIA', 'ANALITICO_SETOR'];

type EditarCargoInput = {
  tenantId: string;
  usuarioId: string;
  cargoId: string;
  unidadeFuncionalId: string;
  nomeCargoMercado: string;
  funcaoGratificada?: number | null;
  periodoInicio: Date;
  salarioMercadoMinimo: number;
  salarioMercadoMaximo: number;
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

    if (!input.unidadeFuncionalId) {
      throw new VinculoFuncionalObrigatorioError();
    }

    const cargoAtual = await this.prisma.cargo.findFirst({
      where: { tenantId: input.tenantId, id: input.cargoId },
    });
    if (!cargoAtual) {
      throw new CargoNaoEncontradoError();
    }

    const unidade = await this.prisma.unidadeFuncional.findFirst({
      where: { tenantId: input.tenantId, id: input.unidadeFuncionalId, propostaId: cargoAtual.propostaId },
    });
    if (!unidade) {
      throw new UnidadeFuncionalNaoEncontradaError();
    }
    if (!TIPOS_ANALITICOS.includes(unidade.tipoNivel)) {
      throw new VinculoCargoNaoAnaliticoError();
    }

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
          unidadeFuncionalId: input.unidadeFuncionalId,
          nomeCargoMercado: nome,
          funcaoGratificada: input.funcaoGratificada ?? null,
          periodoInicio: input.periodoInicio,
          salarioMercadoMinimo: input.salarioMercadoMinimo,
          salarioMercadoMaximo: input.salarioMercadoMaximo,
          fonteAtiva: input.fonteAtiva,
          salarioTotal,
          // salarioReal/statusSyncSalario/syncedAt propositalmente ausentes daqui.
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'CARGO_EDITADO',
          descricao: `Cargo "${cargoAtual.codigoCargo} — ${nome}" editado`,
          dadosSerializados: {
            cargoId: cargo.id,
            unidadeFuncionalId: input.unidadeFuncionalId,
            fonteAtiva: input.fonteAtiva,
            salarioTotal: salarioTotal.toString(),
          },
        },
      });

      return cargo;
    });
  }
}
