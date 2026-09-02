import { describe, expect, it } from 'vitest';
import { filtrarMunicipios, type MunicipioOpcao } from './municipios-br-client';

const catalogo: MunicipioOpcao[] = [
  { codigoIbge: '3550308', nome: 'São Paulo', uf: 'SP', latitude: '-23.5', longitude: '-46.6', rotulo: 'São Paulo — SP' },
  { codigoIbge: '2411403', nome: 'São Paulo do Potengi', uf: 'RN', latitude: '-5.9', longitude: '-35.7', rotulo: 'São Paulo do Potengi — RN' },
  { codigoIbge: '4106902', nome: 'Curitiba', uf: 'PR', latitude: '-25.4', longitude: '-49.2', rotulo: 'Curitiba — PR' },
  { codigoIbge: '5300108', nome: 'Brasília', uf: 'DF', latitude: '-15.7', longitude: '-47.9', rotulo: 'Brasília — DF' },
];

describe('filtrarMunicipios [US-141]', () => {
  it('busca sem acento e sem caixa (São Paulo com "sao paulo")', () => {
    const r = filtrarMunicipios(catalogo, 'sao paulo');
    expect(r.map((m) => m.codigoIbge)).toEqual(['3550308', '2411403']);
  });

  it('inclui homônimos de outras UFs', () => {
    const r = filtrarMunicipios(catalogo, 'são paulo');
    expect(r).toHaveLength(2);
  });

  it('não busca com menos de 2 caracteres', () => {
    expect(filtrarMunicipios(catalogo, 'b')).toEqual([]);
    expect(filtrarMunicipios(catalogo, '')).toEqual([]);
  });

  it('respeita o teto de resultados', () => {
    const grande: MunicipioOpcao[] = Array.from({ length: 50 }, (_, i) => ({
      codigoIbge: String(1000000 + i),
      nome: `Cidade Teste ${i}`,
      uf: 'XX',
      latitude: '0',
      longitude: '0',
      rotulo: `Cidade Teste ${i} — XX`,
    }));
    expect(filtrarMunicipios(grande, 'cidade teste', 20)).toHaveLength(20);
  });
});
