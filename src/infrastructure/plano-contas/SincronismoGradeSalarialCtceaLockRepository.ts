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

/**
 * Lock pessimista por tenant para o sincronismo da Grade Salarial CTCEA
 * [ADR-046]. Tabela própria (SincronismoGradeSalarialCtceaLock), mesmo padrão
 * de SincronismoLockRepository (Plano de Contas) — não reaproveitada porque o
 * lock do Plano de Contas é keyed só por tenantId, e reaproveitá-lo faria as
 * duas sincronizações (fontes independentes) bloquearem uma à outra sem
 * necessidade real.
 */
export class SincronismoGradeSalarialCtceaLockRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async tentarAdquirir(tenantId: string, usuarioId: string): Promise<boolean> {
    try {
      await this.prisma.sincronismoGradeSalarialCtceaLock.create({
        data: { tenantId, emAndamento: true, iniciadoEm: new Date(), iniciadoPor: usuarioId },
      });
      return true;
    } catch (erro) {
      if (!isUniqueConstraintError(erro)) {
        throw erro;
      }

      const atualizado = await this.prisma.sincronismoGradeSalarialCtceaLock.updateMany({
        where: { tenantId, emAndamento: false },
        data: { emAndamento: true, iniciadoEm: new Date(), iniciadoPor: usuarioId },
      });
      return atualizado.count === 1;
    }
  }

  async liberar(tenantId: string): Promise<void> {
    await this.prisma.sincronismoGradeSalarialCtceaLock.updateMany({
      where: { tenantId },
      data: { emAndamento: false },
    });
  }
}
