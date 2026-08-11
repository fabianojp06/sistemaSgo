import type { PrismaClient, Prisma, TipoIncidenciaImposto, PeriodicidadeReajuste } from '@prisma/client';

export type StatusAliquotaImposto = 'ATIVO' | 'INATIVO' | 'EXPIRADA';

export type AliquotaImpostoListada = {
  id: string;
  nome: string;
  aliquotaPct: Prisma.Decimal;
  tipoIncidencia: TipoIncidenciaImposto;
  dataInicioVigencia: Date;
  dataFimVigencia: Date | null;
  limiteMinimoPct: Prisma.Decimal | null;
  limiteMaximoPct: Prisma.Decimal | null;
  observacao: string | null;
  contaSinteticaId: string | null;
  periodicidadeReajuste: PeriodicidadeReajuste;
  ativo: boolean;
  status: StatusAliquotaImposto;
  version: number;
  updatedAt: Date;
  temReferenciaAtiva: boolean;
};

type ListarAliquotasImpostoInput = {
  tenantId: string;
  nome?: string;
  tipoIncidencia?: TipoIncidenciaImposto;
  status?: StatusAliquotaImposto;
  vigenciaInicio?: Date;
  vigenciaFim?: Date;
};

/**
 * UC03.39 — Manter Alíquotas de Impostos (Fluxo Principal). RN_IMP_003: alíquota com
 * dataFimVigencia vencida é exibida como "Expirada" mesmo com ativo=true (calculado, não
 * persistido). RN_IMP_004: [Excluir] só habilitado sem referência ativa em Proposta não congelada.
 */
export class ListarAliquotasImpostoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ListarAliquotasImpostoInput): Promise<AliquotaImpostoListada[]> {
    // dataFimVigencia é calendário puro (meia-noite UTC) — comparar em granularidade de dia
    // (UTC), não com a hora corrente, senão o dia do próprio vencimento já marcaria "Expirada"
    // horas antes de acabar (mesma causa raiz do bug de fuso corrigido em Cadastrar/Editar).
    const hoje = new Date();
    const inicioDoDiaDeHojeUTC = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());

    const registros = await this.prisma.aliquotaImpostoParametro.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.nome ? { nome: { contains: input.nome, mode: 'insensitive' } } : {}),
        ...(input.tipoIncidencia ? { tipoIncidencia: input.tipoIncidencia } : {}),
        ...(input.status === 'ATIVO' ? { ativo: true } : {}),
        ...(input.status === 'INATIVO' ? { ativo: false } : {}),
        ...(input.vigenciaInicio ? { dataInicioVigencia: { gte: input.vigenciaInicio } } : {}),
        ...(input.vigenciaFim ? { dataInicioVigencia: { lte: input.vigenciaFim } } : {}),
      },
      include: {
        rateios: {
          where: { ativo: true, versao: { status: { in: ['RASCUNHO', 'EM_ELABORACAO'] } } },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { nome: 'asc' },
    });

    return registros
      .map((registro) => {
        const expirada = registro.dataFimVigencia !== null && registro.dataFimVigencia.getTime() < inicioDoDiaDeHojeUTC;
        const status: StatusAliquotaImposto = expirada ? 'EXPIRADA' : registro.ativo ? 'ATIVO' : 'INATIVO';
        return {
          id: registro.id,
          nome: registro.nome,
          aliquotaPct: registro.aliquotaPct,
          tipoIncidencia: registro.tipoIncidencia,
          dataInicioVigencia: registro.dataInicioVigencia,
          dataFimVigencia: registro.dataFimVigencia,
          limiteMinimoPct: registro.limiteMinimoPct,
          limiteMaximoPct: registro.limiteMaximoPct,
          observacao: registro.observacao,
          contaSinteticaId: registro.contaSinteticaId,
          periodicidadeReajuste: registro.periodicidadeReajuste,
          ativo: registro.ativo,
          status,
          version: registro.version,
          updatedAt: registro.updatedAt,
          temReferenciaAtiva: registro.rateios.length > 0,
        };
      })
      .filter((registro) => !input.status || input.status === registro.status);
  }
}
