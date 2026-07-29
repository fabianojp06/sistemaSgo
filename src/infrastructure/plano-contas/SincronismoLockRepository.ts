import type { PrismaClient } from '@prisma/client';

const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002';

function isUniqueConstraintError(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    (erro as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE
  );
}

/** Lock pessimista por tenant [RNF_PLA_REQ_007] — rejeita sincronismo concorrente. */
export class SincronismoLockRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async tentarAdquirir(tenantId: string, usuarioId: string): Promise<boolean> {
    try {
      await this.prisma.sincronismoPlanoContasLock.create({
        data: { tenantId, emAndamento: true, iniciadoEm: new Date(), iniciadoPor: usuarioId },
      });
      return true;
    } catch (erro) {
      if (!isUniqueConstraintError(erro)) {
        throw erro;
      }

      const atualizado = await this.prisma.sincronismoPlanoContasLock.updateMany({
        where: { tenantId, emAndamento: false },
        data: { emAndamento: true, iniciadoEm: new Date(), iniciadoPor: usuarioId },
      });
      return atualizado.count === 1;
    }
  }

  async liberar(tenantId: string): Promise<void> {
    await this.prisma.sincronismoPlanoContasLock.updateMany({
      where: { tenantId },
      data: { emAndamento: false },
    });
  }
}
