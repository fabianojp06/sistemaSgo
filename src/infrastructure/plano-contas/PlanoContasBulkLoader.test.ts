import { describe, expect, it, vi } from 'vitest';
import { PlanoContasBulkLoader } from './PlanoContasBulkLoader';
import { ContasOrfasError } from '@/domain/plano-contas/errors';
import type { ContaContabilPayload } from '@/infrastructure/integrations/senior/types';

function criarPrismaMock() {
  const idsGerados = new Map<string, string>();
  let contador = 0;

  const tx = {
    contaContabil: {
      upsert: vi.fn(({ create }: { create: { codigoErp: string; idPai: string | null } }) => {
        contador += 1;
        const id = `id-${contador}`;
        idsGerados.set(create.codigoErp, id);
        return Promise.resolve({ id });
      }),
    },
  };
  type Tx = typeof tx;

  return {
    tx,
    $transaction: vi.fn((callback: (tx: Tx) => Promise<unknown>) => callback(tx)),
  };
}

describe('PlanoContasBulkLoader [UC03.00]', () => {
  it('aborta a ingestão quando há conta analítica órfã [E2, RN_PLA_002]', async () => {
    const prisma = criarPrismaMock();
    const loader = new PlanoContasBulkLoader(prisma as never);

    const payload: ContaContabilPayload[] = [
      { codigoErp: '1.1.11.111', nomeConta: 'Caixa', nivel: 4, codigoPaiErp: '1.1.11', isAnalitica: true },
    ];

    await expect(loader.sincronizar('tenant-1', payload)).rejects.toThrow(ContasOrfasError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('sincroniza em ordem de nível resolvendo idPai pelo codigoErp [RNF_PLA_REQ_004]', async () => {
    const prisma = criarPrismaMock();
    const loader = new PlanoContasBulkLoader(prisma as never);

    const payload: ContaContabilPayload[] = [
      { codigoErp: '1.1.11.111', nomeConta: 'Caixa', nivel: 4, codigoPaiErp: '1.1.11', isAnalitica: true },
      { codigoErp: '1', nomeConta: 'Ativo', nivel: 1, codigoPaiErp: null, isAnalitica: false },
      { codigoErp: '1.1.11', nomeConta: 'Caixa e Equivalentes', nivel: 3, codigoPaiErp: '1.1', isAnalitica: false },
      { codigoErp: '1.1', nomeConta: 'Ativo Circulante', nivel: 2, codigoPaiErp: '1', isAnalitica: false },
    ];

    const resultado = await loader.sincronizar('tenant-1', payload);

    expect(resultado.contasProcessadas).toBe(4);

    const chamadas = prisma.tx.contaContabil.upsert.mock.calls;
    expect(chamadas[0][0].create.codigoErp).toBe('1');
    expect(chamadas[0][0].create.idPai).toBeNull();
    expect(chamadas[3][0].create.codigoErp).toBe('1.1.11.111');
    expect(chamadas[3][0].create.idPai).toBe('id-3'); // id gerado para 1.1.11
  });
});
