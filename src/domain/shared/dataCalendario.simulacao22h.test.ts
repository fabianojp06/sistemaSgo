import { describe, expect, it } from 'vitest';
import { ehDataAnteriorAHoje, hojeNoFusoDoSistema } from './dataCalendario';

describe('simulação do bug de QA — 22h em Brasília (UTC-3)', () => {
  // 2026-08-08 22:00 BRT = 2026-08-09 01:00 UTC. É exatamente a janela em que o bug se
  // manifestava: UTC já é "amanhã" enquanto o calendário real do usuário ainda é "hoje".
  const agora22hBRT = new Date('2026-08-09T01:00:00.000Z');

  it('"hoje" no fuso do sistema continua sendo o dia real do usuário (08/08), não o UTC (09/08)', () => {
    expect(hojeNoFusoDoSistema(agora22hBRT)).toBe('2026-08-08');
  });

  it('a data real de hoje (08/08) NÃO é rejeitada como retroativa', () => {
    const dataDigitadaPeloUsuario = new Date('2026-08-08T00:00:00.000Z'); // vem de z.coerce.date("2026-08-08")
    expect(ehDataAnteriorAHoje(dataDigitadaPeloUsuario, agora22hBRT)).toBe(false);
  });

  it('ontem (07/08) continua sendo rejeitado como retroativo', () => {
    const ontem = new Date('2026-08-07T00:00:00.000Z');
    expect(ehDataAnteriorAHoje(ontem, agora22hBRT)).toBe(true);
  });

  it('amanhã (09/08) continua sendo aceito (não é retroativo)', () => {
    const amanha = new Date('2026-08-09T00:00:00.000Z');
    expect(ehDataAnteriorAHoje(amanha, agora22hBRT)).toBe(false);
  });
});
