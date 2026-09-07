import { describe, expect, it, vi } from 'vitest';
import { ListarPerfisAtivosUseCase } from './ListarPerfisAtivosUseCase';

describe('ListarPerfisAtivosUseCase [US-202]', () => {
  it('projeta perfis ativos com funcionalidades ativas, sem duplicar', async () => {
    const prisma = {
      perfil: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'p1',
            nome: 'Orçamentista',
            descricao: 'Lança e consulta',
            permissoes: [
              { funcionalidade: { id: 'f1', chave: 'a.criar', nome: 'Criar' } },
              { funcionalidade: { id: 'f1', chave: 'a.criar', nome: 'Criar' } },
              { funcionalidade: { id: 'f2', chave: 'a.listar', nome: 'Listar' } },
            ],
          },
        ]),
      },
    };

    const perfis = await new ListarPerfisAtivosUseCase(prisma as never).execute('t1');

    expect(prisma.perfil.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1', ativo: true } }),
    );
    expect(perfis).toEqual([
      {
        id: 'p1',
        nome: 'Orçamentista',
        descricao: 'Lança e consulta',
        funcionalidades: [
          { id: 'f1', chave: 'a.criar', nome: 'Criar' },
          { id: 'f2', chave: 'a.listar', nome: 'Listar' },
        ],
      },
    ]);
  });
});
