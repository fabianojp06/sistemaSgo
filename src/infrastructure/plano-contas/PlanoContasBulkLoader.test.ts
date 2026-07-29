import { describe, expect, it, vi } from 'vitest';
import { PlanoContasBulkLoader } from './PlanoContasBulkLoader';
import { ContasOrfasError } from '@/domain/plano-contas/errors';
import type { ContaContabilPayload } from '@/infrastructure/integrations/senior/types';

function criarPrismaMock(existentes: { id: string; codigoErp: string }[] = []) {
  const upsert = vi.fn((args: { create: { id: string; codigoErp: string; idPai: string | null } }) => args);

  const prisma = {
    contaContabil: {
      findMany: vi.fn().mockResolvedValue(existentes),
      upsert,
    },
    $transaction: vi.fn((operacoes: unknown[]) => Promise.resolve(operacoes)),
  };

  return prisma;
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
    expect(prisma.contaContabil.findMany).not.toHaveBeenCalled();
  });

  it('sincroniza em ordem de nível resolvendo idPai pelo codigoErp, sem transação interativa [RNF_PLA_REQ_004]', async () => {
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

    // $transaction recebe um array de operações já montado, nunca um callback
    // assíncrono — é essa a mudança que evita a transação interativa.
    const [operacoes] = prisma.$transaction.mock.calls[0];
    expect(Array.isArray(operacoes)).toBe(true);
    expect(operacoes).toHaveLength(4);

    const chamadas = prisma.contaContabil.upsert.mock.calls;
    const porCodigo = new Map(chamadas.map(([args]) => [args.create.codigoErp, args.create]));

    const raiz = porCodigo.get('1')!;
    const folha = porCodigo.get('1.1.11.111')!;
    const pai = porCodigo.get('1.1.11')!;

    expect(raiz.idPai).toBeNull();
    expect(folha.idPai).toBe(pai.id);
  });

  it('reaproveita o id de uma conta já existente em vez de gerar um novo', async () => {
    const prisma = criarPrismaMock([{ id: 'id-existente', codigoErp: '1' }]);
    const loader = new PlanoContasBulkLoader(prisma as never);

    const payload: ContaContabilPayload[] = [
      { codigoErp: '1', nomeConta: 'Ativo', nivel: 1, codigoPaiErp: null, isAnalitica: false },
      { codigoErp: '1.1', nomeConta: 'Ativo Circulante', nivel: 2, codigoPaiErp: '1', isAnalitica: false },
    ];

    await loader.sincronizar('tenant-1', payload);

    const chamadas = prisma.contaContabil.upsert.mock.calls;
    const porCodigo = new Map(chamadas.map(([args]) => [args.create.codigoErp, args.create]));

    expect(porCodigo.get('1')!.id).toBe('id-existente');
    expect(porCodigo.get('1.1')!.idPai).toBe('id-existente');
  });
});
