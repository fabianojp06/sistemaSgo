import type { CategoriaEmpregado, EmpregadoHeadcount, PrismaClient } from '@prisma/client';
import {
  CargoNaoEncontradoParaEmpregadoError,
  CargoObrigatorioEmpregadoError,
  CargoRascunhoNaoPodeReceberEmpregadoError,
  ConflitoConcorrenciaError,
  EmpregadoNaoEncontradoError,
  PeriodoInicialRetroativoError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';
import { formatarVinculoFuncionalHerdado } from '@/domain/plano-contas/formatarVinculoFuncionalHerdado';
import {
  montarSnapshotComponenteCustoEmpregado,
  type SnapshotComponenteCustoEmpregado,
} from '@/domain/plano-contas/montarSnapshotComponenteCustoEmpregado';

type EditarEmpregadoInput = {
  tenantId: string;
  usuarioId: string;
  empregadoId: string;
  cargoId: string;
  nome?: string | null;
  categoria: CategoriaEmpregado;
  periodoInicio: Date;
  periodoFim?: Date | null;
  /** Cenário 7 — qualquer valor enviado aqui é ignorado; sempre herdado do Cargo atual. */
  custoTotalMensal?: number | null;
  /** US-105 — updatedAt lido pelo cliente antes de editar; se divergir do atual, é conflito. */
  tokenConcorrencia?: Date;
};

/**
 * US-108 — Editar Empregado. Trocar o cargoId recalcula o snapshot de
 * Vínculo Funcional/Custo Total Mensal (Cenário 6); se o cargo não mudar,
 * o snapshot existente é preservado (não é lido de volta do Cargo).
 */
export class EditarEmpregadoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: EditarEmpregadoInput): Promise<EmpregadoHeadcount> {
    if (!input.cargoId) {
      throw new CargoObrigatorioEmpregadoError();
    }

    const empregadoAtual = await this.prisma.empregadoHeadcount.findFirst({
      where: { tenantId: input.tenantId, id: input.empregadoId },
    });
    if (!empregadoAtual) {
      throw new EmpregadoNaoEncontradoError();
    }

    const proposta = await this.prisma.proposta.findFirst({
      where: { tenantId: input.tenantId, id: empregadoAtual.propostaId },
    });
    if (!proposta || (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO')) {
      throw new VersaoPropostaInvalidaError(
        'Ação Negada: esta Proposta está oficializada e seus dados estão congelados.',
      );
    }
    if (input.periodoInicio.getTime() < proposta.dataInicio.getTime()) {
      throw new PeriodoInicialRetroativoError();
    }

    const nome = input.nome?.trim() || 'A CONTRATAR';

    // Cenário 6 — troca de cargo dispara novo gatilho de herança; se o cargo
    // não mudou, o snapshot atual (vinculoFuncionalHerdado/custoTotalMensal)
    // é preservado, não recarregado do Cargo (ADR-018 — congelado por padrão).
    let vinculoFuncionalHerdado = empregadoAtual.vinculoFuncionalHerdado;
    let custoTotalMensal = empregadoAtual.custoTotalMensal;
    let contaId = empregadoAtual.contaId;
    let codigoCargoParaAuditoria = input.cargoId;
    // ADR-029 — snapshot dos 9 componentes, mesma regra de preservação/recálculo do resto.
    let snapshotComponentes: SnapshotComponenteCustoEmpregado = {
      valorSalarioSnapshot: empregadoAtual.valorSalarioSnapshot,
      valorGratificacaoSnapshot: empregadoAtual.valorGratificacaoSnapshot,
      contaGratificacaoId: empregadoAtual.contaGratificacaoId,
      valorEncargosSociaisSnapshot: empregadoAtual.valorEncargosSociaisSnapshot,
      contaEncargosSociaisId: empregadoAtual.contaEncargosSociaisId,
      valorValeAlimentacaoSnapshot: empregadoAtual.valorValeAlimentacaoSnapshot,
      contaValeAlimentacaoId: empregadoAtual.contaValeAlimentacaoId,
      valorValeRefeicaoSnapshot: empregadoAtual.valorValeRefeicaoSnapshot,
      contaValeRefeicaoId: empregadoAtual.contaValeRefeicaoId,
      valorValeTransporteSnapshot: empregadoAtual.valorValeTransporteSnapshot,
      contaValeTransporteId: empregadoAtual.contaValeTransporteId,
      valorPlanoOdontologicoSnapshot: empregadoAtual.valorPlanoOdontologicoSnapshot,
      contaPlanoOdontologicoId: empregadoAtual.contaPlanoOdontologicoId,
      valorSeguroVidaSnapshot: empregadoAtual.valorSeguroVidaSnapshot,
      contaSeguroVidaId: empregadoAtual.contaSeguroVidaId,
      valorPlanoSaudeSnapshot: empregadoAtual.valorPlanoSaudeSnapshot,
      contaPlanoSaudeId: empregadoAtual.contaPlanoSaudeId,
      valorAuxilioCrecheSnapshot: empregadoAtual.valorAuxilioCrecheSnapshot,
      contaAuxilioCrecheId: empregadoAtual.contaAuxilioCrecheId,
    };

    if (input.cargoId !== empregadoAtual.cargoId) {
      const novoCargo = await this.prisma.cargo.findFirst({
        where: { tenantId: input.tenantId, id: input.cargoId, propostaId: empregadoAtual.propostaId },
        include: { unidadeFuncional: true },
      });
      if (!novoCargo) {
        throw new CargoNaoEncontradoParaEmpregadoError();
      }
      // ADR-042 [TRAVA O ERRO] — mesmo bloqueio de CadastrarEmpregadoUseCase.
      if (novoCargo.status === 'RASCUNHO' || !novoCargo.contaId || !novoCargo.unidadeFuncional) {
        throw new CargoRascunhoNaoPodeReceberEmpregadoError();
      }
      vinculoFuncionalHerdado = formatarVinculoFuncionalHerdado(novoCargo.unidadeFuncional);
      custoTotalMensal = novoCargo.custoTotalCargo;
      contaId = novoCargo.contaId; // ADR-027 — snapshot recalculado só na troca de cargo
      codigoCargoParaAuditoria = novoCargo.codigoCargo;

      const parametro = await this.prisma.parametroSistema.findUnique({ where: { tenantId: input.tenantId } });
      const diasUteisPadrao = parametro?.diasUteisPadrao ?? 22;
      snapshotComponentes = montarSnapshotComponenteCustoEmpregado(novoCargo, diasUteisPadrao);
    }

    // US-105 — se o cliente informou o token e ele já diverge do estado lido, nem tenta:
    // conflito é certo. Evita abrir transação para uma escrita que vamos rejeitar de qualquer forma.
    if (input.tokenConcorrencia && input.tokenConcorrencia.getTime() !== empregadoAtual.updatedAt.getTime()) {
      throw new ConflitoConcorrenciaError();
    }

    return this.prisma.$transaction(async (tx) => {
      // Condição por updatedAt (optimistic locking, US-105) — vale mesmo sem tokenConcorrencia
      // explícito, usando o valor que este próprio use-case acabou de ler.
      const resultado = await tx.empregadoHeadcount.updateMany({
        where: { id: input.empregadoId, updatedAt: empregadoAtual.updatedAt },
        data: {
          cargoId: input.cargoId,
          nome,
          categoria: input.categoria,
          periodoInicio: input.periodoInicio,
          periodoFim: input.periodoFim ?? null,
          // numeroDependentes deliberadamente não tocado — deprecated pelo
          // ADR-020/US-108a; dependentes agora são por benefício.
          vinculoFuncionalHerdado,
          custoTotalMensal,
          contaId,
          ...snapshotComponentes,
        },
      });
      if (resultado.count === 0) {
        throw new ConflitoConcorrenciaError();
      }
      const empregado = await tx.empregadoHeadcount.findUniqueOrThrow({ where: { id: input.empregadoId } });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'EMPREGADO_EDITADO',
          descricao: `Empregado "${empregadoAtual.nome} — ${nome}" editado (cargo: ${codigoCargoParaAuditoria})`,
          dadosSerializados: {
            empregadoId: empregado.id,
            custoTotalMensalAnterior: empregadoAtual.custoTotalMensal.toString(),
            custoTotalMensalNovo: custoTotalMensal.toString(),
          },
        },
      });

      return empregado;
    });
  }
}
