import type { PrismaClient } from '@prisma/client';
import { SenioridadeNomeDuplicadoError } from '@/domain/plano-contas/errors';

type CadastrarSenioridadeInput = {
  tenantId: string;
  usuarioId: string;
  descricao: string;
};

/**
 * US-131, Cenário 3 — GRH cadastra um nível de Senioridade customizado (isPadrao=false,
 * sempre excluível — ver ExcluirSenioridadeUseCase). Júnior/Pleno/Sênior nascem via
 * ListarSenioridadesUseCase, não por este use case.
 */
export class CadastrarSenioridadeUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CadastrarSenioridadeInput) {
    const descricao = input.descricao.trim();

    const duplicada = await this.prisma.senioridade.findFirst({
      where: { tenantId: input.tenantId, descricao: { equals: descricao, mode: 'insensitive' } },
    });
    if (duplicada) {
      throw new SenioridadeNomeDuplicadoError(descricao);
    }

    return this.prisma.$transaction(async (tx) => {
      const criada = await tx.senioridade.create({
        data: { tenantId: input.tenantId, descricao, isPadrao: false },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'SENIORIDADE_CRIADA',
          descricao: `Senioridade "${criada.descricao}" cadastrada`,
          dadosSerializados: { senioridadeId: criada.id, descricao: criada.descricao },
        },
      });

      return criada;
    });
  }
}
