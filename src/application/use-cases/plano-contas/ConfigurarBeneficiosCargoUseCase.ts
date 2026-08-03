import { Prisma, type Cargo, type FaixaPlanoSaude, type PrismaClient } from '@prisma/client';
import { CargoNaoEncontradoError, EncargosSociaisPercentualInvalidoError, ValorBeneficioNegativoError } from '@/domain/plano-contas/errors';
import { calcularCustoTotalCargo } from '@/domain/plano-contas/calcularCustoTotalCargo';

type ConfigurarBeneficiosCargoInput = {
  tenantId: string;
  usuarioId: string;
  cargoId: string;
  encargosSociaisPct: number;
  vaAtivo: boolean;
  vaValorUnitario: number;
  vrAtivo: boolean;
  vrValorUnitario: number;
  planoSaudeAtivo: boolean;
  planoSaudeFaixa?: FaixaPlanoSaude | null;
  planoSaudeValor: number;
  planoOdontoAtivo: boolean;
  planoOdontoValor: number;
  seguroVidaAtivo: boolean;
  seguroVidaValor: number;
  auxilioCrecheAtivo: boolean;
  auxilioCrecheValor: number;
  transporteAtivo: boolean;
  transporteValorUnitario: number;
};

const CAMPOS_VALOR_NAO_NEGATIVO = [
  'vaValorUnitario',
  'vrValorUnitario',
  'planoSaudeValor',
  'planoOdontoValor',
  'seguroVidaValor',
  'auxilioCrecheValor',
  'transporteValorUnitario',
] as const;

/**
 * US-107a — Tabela Mestre de Benefícios e Encargos do Cargo (bloco C do
 * UC03.19, sem numeração própria na Minuta — não confundir com UC03.28,
 * que é a elegibilidade individual do Empregado, US-108a). custoTotalCargo
 * é sempre recalculado, nunca aceito como input direto [ORIGEM BLINDADA].
 */
export class ConfigurarBeneficiosCargoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ConfigurarBeneficiosCargoInput): Promise<Cargo> {
    if (input.encargosSociaisPct < 0 || input.encargosSociaisPct > 100) {
      throw new EncargosSociaisPercentualInvalidoError();
    }
    for (const campo of CAMPOS_VALOR_NAO_NEGATIVO) {
      if (input[campo] < 0) {
        throw new ValorBeneficioNegativoError();
      }
    }

    const cargo = await this.prisma.cargo.findFirst({ where: { tenantId: input.tenantId, id: input.cargoId } });
    if (!cargo) {
      throw new CargoNaoEncontradoError();
    }

    const parametro = await this.prisma.parametroSistema.findUnique({ where: { tenantId: input.tenantId } });
    const diasUteisPadrao = parametro?.diasUteisPadrao ?? 22;

    const dadosBeneficios = {
      encargosSociaisPct: new Prisma.Decimal(input.encargosSociaisPct),
      vaAtivo: input.vaAtivo,
      vaValorUnitario: new Prisma.Decimal(input.vaValorUnitario),
      vrAtivo: input.vrAtivo,
      vrValorUnitario: new Prisma.Decimal(input.vrValorUnitario),
      planoSaudeAtivo: input.planoSaudeAtivo,
      planoSaudeFaixa: input.planoSaudeFaixa ?? null,
      planoSaudeValor: new Prisma.Decimal(input.planoSaudeValor),
      planoOdontoAtivo: input.planoOdontoAtivo,
      planoOdontoValor: new Prisma.Decimal(input.planoOdontoValor),
      seguroVidaAtivo: input.seguroVidaAtivo,
      seguroVidaValor: new Prisma.Decimal(input.seguroVidaValor),
      auxilioCrecheAtivo: input.auxilioCrecheAtivo,
      auxilioCrecheValor: new Prisma.Decimal(input.auxilioCrecheValor),
      transporteAtivo: input.transporteAtivo,
      transporteValorUnitario: new Prisma.Decimal(input.transporteValorUnitario),
    };

    const custoTotalCargo = calcularCustoTotalCargo(cargo.salarioTotal, dadosBeneficios, diasUteisPadrao);
    // Heurística de auditoria: estado "nunca configurado" é o default (0%, tudo inativo).
    const jaConfigurado = !cargo.encargosSociaisPct.isZero() || cargo.vaAtivo || cargo.vrAtivo || cargo.planoSaudeAtivo || cargo.planoOdontoAtivo || cargo.seguroVidaAtivo || cargo.auxilioCrecheAtivo || cargo.transporteAtivo;

    return this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.cargo.update({
        where: { id: input.cargoId },
        data: { ...dadosBeneficios, custoTotalCargo },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: jaConfigurado ? 'CARGO_BENEFICIOS_EDITADOS' : 'CARGO_BENEFICIOS_CONFIGURADOS',
          descricao: `Benefícios e Encargos do Cargo "${cargo.codigoCargo}" ${jaConfigurado ? 'editados' : 'configurados'}`,
          dadosSerializados: {
            cargoId: cargo.id,
            custoTotalCargoAnterior: cargo.custoTotalCargo.toString(),
            custoTotalCargoNovo: custoTotalCargo.toString(),
          },
        },
      });

      return atualizado;
    });
  }
}
