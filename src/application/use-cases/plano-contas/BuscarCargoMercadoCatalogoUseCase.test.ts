import { describe, expect, it, vi } from 'vitest';
import { BuscarCargoMercadoCatalogoUseCase } from './BuscarCargoMercadoCatalogoUseCase';
import type { CargoMercadoProvider } from '@/infrastructure/integrations/cargo-mercado/types';

function criarProviderMock(catalogo: Array<{ codigoOrigem: string; nome: string }>): {
  provider: CargoMercadoProvider;
  buscarCatalogoAtivo: ReturnType<typeof vi.fn>;
} {
  const buscarCatalogoAtivo = vi.fn().mockResolvedValue(catalogo);
  return { provider: { buscarCatalogoAtivo }, buscarCatalogoAtivo };
}

describe('BuscarCargoMercadoCatalogoUseCase [ADR-047/US-139]', () => {
  it('retorna vazio sem consultar o catálogo quando o termo tem menos de 2 caracteres (Cenário 5)', async () => {
    const { provider, buscarCatalogoAtivo } = criarProviderMock([]);
    const useCase = new BuscarCargoMercadoCatalogoUseCase(provider);

    const resultado = await useCase.execute('a');

    expect(resultado).toEqual([]);
    expect(buscarCatalogoAtivo).not.toHaveBeenCalled();
  });

  it('busca por substring case-insensitive, ordena por nome e limita a 20 resultados', async () => {
    const catalogo = [
      { codigoOrigem: '2', nome: 'ADMINISTRADOR DE REDES' },
      { codigoOrigem: '1', nome: 'ADMINISTRADOR DE BANCO DE DADOS' },
      { codigoOrigem: '3', nome: 'ENFERMEIRO' },
    ];
    const { provider } = criarProviderMock(catalogo);
    const useCase = new BuscarCargoMercadoCatalogoUseCase(provider);

    const resultado = await useCase.execute(' administrador ');

    // Só os que casam, ordenados alfabeticamente.
    expect(resultado).toEqual([
      { codigoOrigem: '1', nome: 'ADMINISTRADOR DE BANCO DE DADOS' },
      { codigoOrigem: '2', nome: 'ADMINISTRADOR DE REDES' },
    ]);
  });

  it('limita a 20 resultados mesmo quando o termo casa com mais linhas', async () => {
    const catalogo = Array.from({ length: 25 }, (_, i) => ({
      codigoOrigem: String(i),
      nome: `ANALISTA ${String(i).padStart(2, '0')}`,
    }));
    const { provider } = criarProviderMock(catalogo);
    const useCase = new BuscarCargoMercadoCatalogoUseCase(provider);

    const resultado = await useCase.execute('analista');

    expect(resultado).toHaveLength(20);
  });

  it('retorna lista vazia quando nenhum cargo corresponde ao termo', async () => {
    const { provider } = criarProviderMock([{ codigoOrigem: '1', nome: 'ENFERMEIRO' }]);
    const useCase = new BuscarCargoMercadoCatalogoUseCase(provider);

    const resultado = await useCase.execute('termo-inexistente');

    expect(resultado).toEqual([]);
  });
});
