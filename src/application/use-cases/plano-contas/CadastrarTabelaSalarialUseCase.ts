import { Prisma, type PrismaClient } from '@prisma/client';
import { CargoNaoEncontradoError, SalarioMinimoMaiorIgualMaximoError, SenioridadeNaoEncontradaError } from '@/domain/plano-contas/errors';

type CadastrarTabelaSalarialInput = {
  tenantId: string;
  usuarioId: string;
  cargoId: string;
  senioridadeId: string;
  salarioMinimo: Prisma.Decimal.Value;
  salarioMaximo: Prisma.Decimal.Value;
};

/**
 * US-131, Cenário 1/2 — cadastra uma faixa de mercado (Cargo + Senioridade + Mín/Máx).
 * RN_TAB_02 [TRAVA O ERRO]: Mínimo < Máximo. RN_TAB_03: não é chave única — múltiplos
 * registros do mesmo par Cargo+Senioridade são permitidos por desenho.
 */
export class CadastrarTabelaSalarialUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CadastrarTabelaSalarialInput) {
    const salarioMinimo = new Prisma.Decimal(input.salarioMinimo);
    const salarioMaximo = new Prisma.Decimal(input.salarioMaximo);
    if (salarioMinimo.greaterThanOrEqualTo(salarioMaximo)) {
      throw new SalarioMinimoMaiorIgualMaximoError();
    }

    const cargo = await this.prisma.cargo.findFirst({
      where: { tenantId: input.tenantId, id: input.cargoId, ativo: true },
      select: { id: true },
    });
    if (!cargo) {
      throw new CargoNaoEncontradoError();
    }

    const senioridade = await this.prisma.senioridade.findFirst({
      where: { tenantId: input.tenantId, id: input.senioridadeId, ativo: true },
      select: { id: true, descricao: true },
    });
    if (!senioridade) {
      throw new SenioridadeNaoEncontradaError();
    }

    return this.prisma.$transaction(async (tx) => {
      const criado = await tx.tabelaSalarial.create({
        data: {
          tenantId: input.tenantId,
          cargoId: input.cargoId,
          senioridadeId: input.senioridadeId,
          salarioMinimo,
          salarioMaximo,
          criadoPorId: input.usuarioId,
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'TABELA_SALARIAL_CADASTRADA',
          descricao: `Faixa salarial cadastrada para o Cargo (Senioridade "${senioridade.descricao}")`,
          dadosSerializados: {
            tabelaSalarialId: criado.id,
            cargoId: input.cargoId,
            senioridadeId: input.senioridadeId,
            salarioMinimo: salarioMinimo.toString(),
            salarioMaximo: salarioMaximo.toString(),
          },
        },
      });

      return criado;
    });
  }
}
