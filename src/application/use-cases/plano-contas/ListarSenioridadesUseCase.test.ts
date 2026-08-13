import { describe, expect, it, vi } from 'vitest';
import { ListarSenioridadesUseCase } from './ListarSenioridadesUseCase';

function criarPrismaMock(registros: { id: string; descricao: string; isPadrao: boolean }[]) {
  return {
    senioridade: {
      upsert: vi.fn(() => Promise.resolve({})),
      findMany: vi.fn(() => Promise.resolve(registros)),
    },
  };
}

describe('ListarSenioridadesUseCase', () => {
  it('garante Júnior/Pleno/Sênior (upsert idempotente) antes de listar [RN_TAB_01]', async () => {
    const base = criarPrismaMock([
      { id: 's1', descricao: 'Júnior', isPadrao: true },
      { id: 's2', descricao: 'Pleno', isPadrao: true },
      { id: 's3', descricao: 'Sênior', isPadrao: true },
    ]);
    const useCase = new ListarSenioridadesUseCase(base as never);

    const resultado = await useCase.execute({ tenantId: 't1' });

    expect(base.senioridade.upsert).toHaveBeenCalledTimes(3);
    expect(resultado).toHaveLength(3);
  });

  it('inclui Senioridades customizadas na listagem', async () => {
    const base = criarPrismaMock([
      { id: 's1', descricao: 'Júnior', isPadrao: true },
      { id: 's4', descricao: 'Especialista', isPadrao: false },
    ]);
    const useCase = new ListarSenioridadesUseCase(base as never);

    const resultado = await useCase.execute({ tenantId: 't1' });

    expect(resultado.map((r) => r.descricao)).toContain('Especialista');
  });
});
