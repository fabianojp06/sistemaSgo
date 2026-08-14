import { describe, expect, it } from 'vitest';
import { CargoRubiFixtureProvider } from './CargoRubiFixtureProvider';

describe('CargoRubiFixtureProvider.buscarCargosPorTermo [ADR-045, US-132]', () => {
  it('é determinístico — o mesmo termo sempre retorna os mesmos candidatos', async () => {
    const provider = new CargoRubiFixtureProvider();

    const primeira = await provider.buscarCargosPorTermo('Analista de Sistemas');
    const segunda = await provider.buscarCargosPorTermo('Analista de Sistemas');

    expect(primeira).toEqual(segunda);
  });

  it('retorna de 1 a 3 candidatos, cada um com os 5 campos preenchidos', async () => {
    const provider = new CargoRubiFixtureProvider();

    const candidatos = await provider.buscarCargosPorTermo('Assessor Técnico');

    expect(candidatos.length).toBeGreaterThanOrEqual(1);
    expect(candidatos.length).toBeLessThanOrEqual(3);
    for (const candidato of candidatos) {
      expect(candidato.nomeCargoMercado.length).toBeGreaterThan(0);
      expect(candidato.tabSalCodigo.length).toBeGreaterThan(0);
      expect(candidato.tabSalDescricao.length).toBeGreaterThan(0);
      expect(candidato.faixaCodigo.length).toBeGreaterThan(0);
      expect(candidato.faixaDescricao.length).toBeGreaterThan(0);
      expect(candidato.nivelCodigo.length).toBeGreaterThan(0);
      expect(candidato.nivelDescricao.length).toBeGreaterThan(0);
      expect(candidato.salarioReal.toNumber()).toBeGreaterThan(0);
    }
  });

  it('termos diferentes tendem a gerar candidatos diferentes', async () => {
    const provider = new CargoRubiFixtureProvider();

    const a = await provider.buscarCargosPorTermo('Analista de Sistemas');
    const b = await provider.buscarCargosPorTermo('Assessor Técnico');

    expect(a[0].nomeCargoMercado).not.toBe(b[0].nomeCargoMercado);
  });

  it('retorna lista vazia para termo vazio (sem quebrar)', async () => {
    const provider = new CargoRubiFixtureProvider();

    const candidatos = await provider.buscarCargosPorTermo('   ');

    expect(candidatos).toEqual([]);
  });

  it('nunca quebra por índice negativo, para qualquer termo (regressão: hash >> N com sinal gerava índice fora da faixa)', async () => {
    const provider = new CargoRubiFixtureProvider();
    const termos = [
      'Assistente Administrativo',
      'Coordenador de RH',
      'Analista de Sistemas',
      'Contador',
      'Assessor Técnico',
      'Gerente de Projetos',
      'Auxiliar de Serviços Gerais',
      'Supervisor de Operações',
      'Especialista em Compliance',
      'Técnico de Segurança do Trabalho',
    ];

    for (const termo of termos) {
      const candidatos = await provider.buscarCargosPorTermo(termo);
      for (const candidato of candidatos) {
        expect(candidato.faixaCodigo).toBeTruthy();
        expect(candidato.faixaDescricao).toBeTruthy();
        expect(candidato.nivelCodigo).toBeTruthy();
        expect(candidato.nivelDescricao).toBeTruthy();
      }
    }
  });
});
