import { describe, expect, it } from 'vitest';
import { resolverMunicipioBr } from './municipio-br-catalogo';
import { MUNICIPIOS_BR_RAW } from './municipios-brasileiros-raw';

describe('resolverMunicipioBr [US-141 / ADR-048]', () => {
  it('resolve um código IBGE conhecido para nome + UF', () => {
    const sp = resolverMunicipioBr('3550308');
    expect(sp).not.toBeNull();
    expect(sp?.nome).toBe('São Paulo');
    expect(sp?.uf).toBe('SP');
  });

  it('retorna null para código inexistente', () => {
    expect(resolverMunicipioBr('9999999')).toBeNull();
    expect(resolverMunicipioBr('')).toBeNull();
  });

  it('o catálogo embutido tem todos os municípios com código de 7 dígitos e UF de 2 letras', () => {
    expect(MUNICIPIOS_BR_RAW.length).toBeGreaterThan(5500);
    for (const m of MUNICIPIOS_BR_RAW) {
      expect(m.codigoIbge).toMatch(/^\d{7}$/);
      expect(m.uf).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('não há códigos IBGE duplicados no catálogo', () => {
    const codigos = new Set(MUNICIPIOS_BR_RAW.map((m) => m.codigoIbge));
    expect(codigos.size).toBe(MUNICIPIOS_BR_RAW.length);
  });
});
