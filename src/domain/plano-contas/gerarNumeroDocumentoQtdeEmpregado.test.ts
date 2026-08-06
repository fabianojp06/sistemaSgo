import { describe, expect, it, vi } from 'vitest';
import { gerarProximoNumeroDocumentoQtdeEmpregado } from './gerarNumeroDocumentoQtdeEmpregado';

function criarPrismaMock(documentos: string[]) {
  return {
    qtdeEmpregado: {
      findFirst: vi.fn(() => {
        const ordenado = [...documentos].sort((a, b) => b.localeCompare(a));
        return Promise.resolve(ordenado[0] ? { numeroDocumento: ordenado[0] } : null);
      }),
    },
  };
}

describe('gerarProximoNumeroDocumentoQtdeEmpregado [US-113]', () => {
  it('gera "C-001" quando não há documento anterior', async () => {
    const prisma = criarPrismaMock([]);

    const numero = await gerarProximoNumeroDocumentoQtdeEmpregado(prisma as never, 't1', 'p1');

    expect(numero).toBe('C-001');
  });

  it('incrementa a partir do último sequencial existente', async () => {
    const prisma = criarPrismaMock(['C-001', 'C-002', 'C-007']);

    const numero = await gerarProximoNumeroDocumentoQtdeEmpregado(prisma as never, 't1', 'p1');

    expect(numero).toBe('C-008');
  });

  it('aplica zero-padding de 3 dígitos', async () => {
    const prisma = criarPrismaMock(['C-009']);

    const numero = await gerarProximoNumeroDocumentoQtdeEmpregado(prisma as never, 't1', 'p1');

    expect(numero).toBe('C-010');
  });
});
