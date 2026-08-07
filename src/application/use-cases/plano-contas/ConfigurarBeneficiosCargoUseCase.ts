import { Prisma, type Cargo, type FaixaPlanoSaude, type PrismaClient } from '@prisma/client';
import { CargoNaoEncontradoError, EncargosSociaisPercentualInvalidoError, ValorBeneficioNegativoError } from '@/domain/plano-contas/errors';
import { calcularCustoTotalCargo } from '@/domain/plano-contas/calcularCustoTotalCargo';
import { validarContasComponenteCusto } from '@/domain/plano-contas/validarContasComponenteCusto';

type ConfigurarBeneficiosCargoInput = {
  tenantId: string;
  usuarioId: string;
  cargoId: string;
  encargosSociaisPct: number;
  /** ADR-029 — conta analítica de cada componente; null se ainda não configurada. */
  contaEncargosSociaisId?: string | null;
  vaAtivo: boolean;
  vaValorUnitario: number;
  contaValeAlimentacaoId?: string | null;
  vrAtivo: boolean;
  vrValorUnitario: number;
  contaValeRefeicaoId?: string | null;
  planoSaudeAtivo: boolean;
  planoSaudeFaixa?: FaixaPlanoSaude | null;
  planoSaudeValor: number;
  contaPlanoSaudeId?: string | null;
  planoOdontoAtivo: boolean;
  planoOdontoValor: number;
  contaPlanoOdontologicoId?: string | null;
  seguroVidaAtivo: boolean;
  seguroVidaValor: number;
  contaSeguroVidaId?: string | null;
  auxilioCrecheAtivo: boolean;
  auxilioCrecheValor: number;
  contaAuxilioCrecheId?: string | null;
  transporteAtivo: boolean;
  transporteValorUnitario: number;
  contaValeTransporteId?: string | null;
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

    // ADR-029 [TRAVA O ERRO] — contas informadas precisam ser analíticas.
    await validarContasComponenteCusto(this.prisma, input.tenantId, {
      encargosSociais: { id: input.contaEncargosSociaisId ?? null, label: 'Encargos Sociais' },
      valeAlimentacao: { id: input.contaValeAlimentacaoId ?? null, label: 'Vale Alimentação' },
      valeRefeicao: { id: input.contaValeRefeicaoId ?? null, label: 'Vale Refeição' },
      planoSaude: { id: input.contaPlanoSaudeId ?? null, label: 'Plano de Saúde' },
      planoOdonto: { id: input.contaPlanoOdontologicoId ?? null, label: 'Plano Odontológico' },
      seguroVida: { id: input.contaSeguroVidaId ?? null, label: 'Seguro de Vida' },
      auxilioCreche: { id: input.contaAuxilioCrecheId ?? null, label: 'Auxílio Creche' },
      valeTransporte: { id: input.contaValeTransporteId ?? null, label: 'Vale Transporte' },
    });

    const parametro = await this.prisma.parametroSistema.findUnique({ where: { tenantId: input.tenantId } });
    const diasUteisPadrao = parametro?.diasUteisPadrao ?? 22;

    const dadosBeneficios = {
      encargosSociaisPct: new Prisma.Decimal(input.encargosSociaisPct),
      contaEncargosSociaisId: input.contaEncargosSociaisId ?? null,
      vaAtivo: input.vaAtivo,
      vaValorUnitario: new Prisma.Decimal(input.vaValorUnitario),
      contaValeAlimentacaoId: input.contaValeAlimentacaoId ?? null,
      vrAtivo: input.vrAtivo,
      vrValorUnitario: new Prisma.Decimal(input.vrValorUnitario),
      contaValeRefeicaoId: input.contaValeRefeicaoId ?? null,
      planoSaudeAtivo: input.planoSaudeAtivo,
      planoSaudeFaixa: input.planoSaudeFaixa ?? null,
      planoSaudeValor: new Prisma.Decimal(input.planoSaudeValor),
      contaPlanoSaudeId: input.contaPlanoSaudeId ?? null,
      planoOdontoAtivo: input.planoOdontoAtivo,
      planoOdontoValor: new Prisma.Decimal(input.planoOdontoValor),
      contaPlanoOdontologicoId: input.contaPlanoOdontologicoId ?? null,
      seguroVidaAtivo: input.seguroVidaAtivo,
      seguroVidaValor: new Prisma.Decimal(input.seguroVidaValor),
      contaSeguroVidaId: input.contaSeguroVidaId ?? null,
      auxilioCrecheAtivo: input.auxilioCrecheAtivo,
      auxilioCrecheValor: new Prisma.Decimal(input.auxilioCrecheValor),
      contaAuxilioCrecheId: input.contaAuxilioCrecheId ?? null,
      transporteAtivo: input.transporteAtivo,
      transporteValorUnitario: new Prisma.Decimal(input.transporteValorUnitario),
      contaValeTransporteId: input.contaValeTransporteId ?? null,
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
