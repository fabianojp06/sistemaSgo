import type { CategoriaEmpregado, EmpregadoHeadcount, PrismaClient } from '@prisma/client';
import {
  CargoNaoEncontradoParaEmpregadoError,
  CargoObrigatorioEmpregadoError,
  EmpregadoForaDeEscopoCategoriaError,
  PeriodoInicialRetroativoError,
  PropostaNaoEncontradaError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';

type CadastrarEmpregadoInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  cargoId: string;
  nome?: string | null;
  categoria: CategoriaEmpregado;
  periodoInicio: Date;
  periodoFim?: Date | null;
};

/**
 * US-108 — Cadastrar Empregado. Restrita a Proposta categoria=CONSOLIDADA
 * nesta US. Herda (snapshot) Vínculo Funcional e Custo Total Mensal do
 * Cargo no momento do cadastro — congelado até troca explícita de Cargo
 * [ORIGEM BLINDADA, ADR-018].
 */
export class CadastrarEmpregadoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CadastrarEmpregadoInput): Promise<EmpregadoHeadcount> {
    if (!input.cargoId) {
      throw new CargoObrigatorioEmpregadoError();
    }

    const proposta = await this.prisma.proposta.findFirst({ where: { tenantId: input.tenantId, id: input.propostaId } });
    if (!proposta) {
      throw new PropostaNaoEncontradaError();
    }
    if (proposta.categoria !== 'CONSOLIDADA') {
      throw new EmpregadoForaDeEscopoCategoriaError();
    }
    if (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO') {
      throw new VersaoPropostaInvalidaError(
        'Ação Negada [TRAVA O ERRO]: esta Proposta está oficializada e seus dados estão congelados.',
      );
    }
    if (input.periodoInicio.getTime() < proposta.dataInicio.getTime()) {
      throw new PeriodoInicialRetroativoError();
    }

    const cargo = await this.prisma.cargo.findFirst({
      where: { tenantId: input.tenantId, id: input.cargoId, propostaId: input.propostaId },
      include: { unidadeFuncional: true },
    });
    if (!cargo) {
      throw new CargoNaoEncontradoParaEmpregadoError();
    }

    const nome = input.nome?.trim() || 'A CONTRATAR'; // RN0249

    return this.prisma.$transaction(async (tx) => {
      const empregado = await tx.empregadoHeadcount.create({
        data: {
          tenantId: input.tenantId,
          propostaId: input.propostaId,
          cargoId: input.cargoId,
          nome,
          categoria: input.categoria,
          periodoInicio: input.periodoInicio,
          periodoFim: input.periodoFim ?? null,
          // numeroDependentes deliberadamente omitido (default 0) — deprecated
          // pelo ADR-020/US-108a; dependentes agora são por benefício em
          // EmpregadoBeneficioElegibilidade.
          vinculoFuncionalHerdado: cargo.unidadeFuncional.nome,
          custoTotalMensal: cargo.custoTotalCargo,
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'EMPREGADO_CRIADO',
          descricao: `Empregado "${nome}" cadastrado no cargo "${cargo.codigoCargo}"`,
          dadosSerializados: {
            empregadoId: empregado.id,
            propostaId: input.propostaId,
            cargoId: input.cargoId,
            custoTotalMensal: cargo.custoTotalCargo.toString(),
          },
        },
      });

      return empregado;
    });
  }
}
