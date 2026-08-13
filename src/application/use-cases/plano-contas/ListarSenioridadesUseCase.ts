import type { PrismaClient, Senioridade } from '@prisma/client';

const SENIORIDADES_PADRAO = ['Júnior', 'Pleno', 'Sênior'];

type ListarSenioridadesInput = {
  tenantId: string;
};

/**
 * US-131, RN_TAB_01 — garante que Júnior/Pleno/Sênior existam (protegidas, isPadrao=true)
 * antes de listar. Não há bootstrap de tenant separado no projeto (seed.mjs roda 1x por
 * ambiente, não por tenant) — o upsert idempotente aqui garante o catálogo padrão em
 * qualquer tenant, mesmo criado depois do seed original.
 */
export class ListarSenioridadesUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ListarSenioridadesInput): Promise<Senioridade[]> {
    await Promise.all(
      SENIORIDADES_PADRAO.map((descricao) =>
        this.prisma.senioridade.upsert({
          where: { tenantId_descricao: { tenantId: input.tenantId, descricao } },
          update: {},
          create: { tenantId: input.tenantId, descricao, isPadrao: true },
        }),
      ),
    );

    return this.prisma.senioridade.findMany({
      where: { tenantId: input.tenantId, ativo: true },
      orderBy: [{ isPadrao: 'desc' }, { descricao: 'asc' }],
    });
  }
}
