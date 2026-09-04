import { Prisma, type PrismaClient } from '@prisma/client';
import { calcularMesesSobreposicao } from '@/domain/shared/calcularMesesSobreposicao';

/**
 * ADR-032 — soma, por conta analítica, o custo REALIZADO já gerado por uma
 * Versão de Proposta: Viagem, ItemPatrimonial e RateioImpostoGrade (já são
 * valor total, somados como estão) + Empregado (única fonte mensal
 * recorrente — cada componente de snapshot é multiplicado pelos meses de
 * sobreposição entre o período do Empregado e o período da Proposta).
 *
 * Extraído de CalcularValorRealizadoUseCase (Semáforo) para reuso — mesmo
 * cálculo agora também alimenta o dashboard da guia Valor Orçado (US-118),
 * que é só um consumidor desta informação, sem cálculo próprio.
 */
export class ValorRealizadoService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * ADR-032 — custo REALIZADO por conta analítica: as 3 fontes de custo bruto
   * (Viagem + ItemPatrimonial + Empregado) MAIS o `RateioImpostoGrade` (imposto
   * declarado/calculado). É o número "com imposto".
   */
  async somarPorContaAnalitica(tenantId: string, versaoId: string): Promise<Map<string, Prisma.Decimal>> {
    const porConta = await this.somarCustoBrutoPorConta(tenantId, versaoId);
    const soma = (contaId: string, valor: Prisma.Decimal) =>
      porConta.set(contaId, (porConta.get(contaId) ?? new Prisma.Decimal(0)).plus(valor));

    // US-144/ADR-050 §C — os rateios de imposto entram SÓ aqui, nunca em
    // `somarCustoBrutoPorConta` (a base do motor de imposto não pode conter
    // imposto — evita referência circular).
    const rateiosImposto = await this.prisma.rateioImpostoGrade.findMany({
      where: { tenantId, versaoId, ativo: true },
      select: { contaId: true, valorDeclarado: true },
    });
    for (const rateio of rateiosImposto) {
      soma(rateio.contaId, rateio.valorDeclarado);
    }

    return porConta;
  }

  /**
   * US-144/ADR-050 §C — base bruta por conta analítica: Viagem + ItemPatrimonial
   * + Empregado, SEM nenhum `RateioImpostoGrade`. É a base sobre a qual o motor
   * de imposto (`GerarImpostosDaVersaoUseCase`) calcula `imposto = base × alíquota%`.
   */
  async somarCustoBrutoPorConta(tenantId: string, versaoId: string): Promise<Map<string, Prisma.Decimal>> {
    const porConta = new Map<string, Prisma.Decimal>();
    const soma = (contaId: string, valor: Prisma.Decimal) =>
      porConta.set(contaId, (porConta.get(contaId) ?? new Prisma.Decimal(0)).plus(valor));

    const viagens = await this.prisma.viagem.findMany({
      where: { tenantId, versaoId, ativo: true },
      select: {
        contaPassagemId: true,
        contaDiariaId: true,
        contaTransporteId: true,
        quantidadePessoas: true,
        mediaDias: true,
        custoUnitarioPassagem: true,
        custoUnitarioDiaria: true,
        custoUnitarioTransporte: true,
      },
    });
    for (const v of viagens) {
      soma(v.contaPassagemId, v.custoUnitarioPassagem.times(v.quantidadePessoas));
      soma(v.contaDiariaId, v.custoUnitarioDiaria.times(v.quantidadePessoas).times(v.mediaDias));
      soma(v.contaTransporteId, v.custoUnitarioTransporte.times(v.quantidadePessoas));
    }

    const itens = await this.prisma.itemPatrimonial.findMany({
      where: { tenantId, versaoId, ativo: true },
      select: { contaId: true, valorTotal: true },
    });
    for (const item of itens) {
      soma(item.contaId, item.valorTotal);
    }

    // ADR-027 — Empregado não tem versaoId direto (escopado por Proposta); a
    // conta é o snapshot herdado do Cargo no momento do vínculo.
    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId, id: versaoId },
      select: { propostaId: true, proposta: { select: { dataInicio: true, dataFim: true } } },
    });
    if (versao) {
      const empregados = await this.prisma.empregadoHeadcount.findMany({
        where: { tenantId, propostaId: versao.propostaId, ativo: true },
        select: {
          periodoInicio: true,
          periodoFim: true,
          contaId: true,
          valorSalarioSnapshot: true,
          valorGratificacaoSnapshot: true,
          contaGratificacaoId: true,
          valorEncargosSociaisSnapshot: true,
          contaEncargosSociaisId: true,
          valorValeAlimentacaoSnapshot: true,
          contaValeAlimentacaoId: true,
          valorValeRefeicaoSnapshot: true,
          contaValeRefeicaoId: true,
          valorValeTransporteSnapshot: true,
          contaValeTransporteId: true,
          valorPlanoOdontologicoSnapshot: true,
          contaPlanoOdontologicoId: true,
          valorSeguroVidaSnapshot: true,
          contaSeguroVidaId: true,
          valorPlanoSaudeSnapshot: true,
          contaPlanoSaudeId: true,
          valorAuxilioCrecheSnapshot: true,
          contaAuxilioCrecheId: true,
        },
      });
      // ADR-032 — Empregado é a única fonte de custo MENSAL recorrente (as
      // demais — Viagem, ItemPatrimonial, RateioImpostoGrade — já são valor
      // total). Cada componente é multiplicado pelos meses de sobreposição
      // entre o período do Empregado ([periodoInicio, periodoFim ?? dataFim
      // da Proposta]) e o período da própria Proposta. Sem sobreposição, o
      // Empregado não contribui em nada.
      for (const empregado of empregados) {
        const fimEmpregado = empregado.periodoFim ?? versao.proposta.dataFim;
        const meses = calcularMesesSobreposicao(
          empregado.periodoInicio,
          fimEmpregado,
          versao.proposta.dataInicio,
          versao.proposta.dataFim,
        );
        if (meses === 0) continue;

        const multiplicar = (valor: Prisma.Decimal) => valor.times(meses);

        // ADR-029 — cada componente vai para sua própria conta (snapshot); sem
        // conta configurada, cai na conta de salário do próprio Empregado
        // (nunca some, nunca duplica — valorSalarioSnapshot já é residual).
        soma(empregado.contaId, multiplicar(empregado.valorSalarioSnapshot));
        soma(empregado.contaGratificacaoId ?? empregado.contaId, multiplicar(empregado.valorGratificacaoSnapshot));
        soma(empregado.contaEncargosSociaisId ?? empregado.contaId, multiplicar(empregado.valorEncargosSociaisSnapshot));
        soma(empregado.contaValeAlimentacaoId ?? empregado.contaId, multiplicar(empregado.valorValeAlimentacaoSnapshot));
        soma(empregado.contaValeRefeicaoId ?? empregado.contaId, multiplicar(empregado.valorValeRefeicaoSnapshot));
        soma(empregado.contaValeTransporteId ?? empregado.contaId, multiplicar(empregado.valorValeTransporteSnapshot));
        soma(empregado.contaPlanoOdontologicoId ?? empregado.contaId, multiplicar(empregado.valorPlanoOdontologicoSnapshot));
        soma(empregado.contaSeguroVidaId ?? empregado.contaId, multiplicar(empregado.valorSeguroVidaSnapshot));
        soma(empregado.contaPlanoSaudeId ?? empregado.contaId, multiplicar(empregado.valorPlanoSaudeSnapshot));
        soma(empregado.contaAuxilioCrecheId ?? empregado.contaId, multiplicar(empregado.valorAuxilioCrecheSnapshot));
      }
    }

    return porConta;
  }
}
