import { describe, expect, it } from 'vitest';
import { deveBloquear, ehElegivelParaBloqueioAutomatico, ehUltimaTentativa } from './regras-bloqueio';

describe('deveBloquear [RN0024]', () => {
  it('bloqueia quando o contador atinge exatamente o limite', () => {
    expect(deveBloquear(5, 5)).toBe(true);
  });

  it('não bloqueia abaixo do limite', () => {
    expect(deveBloquear(4, 5)).toBe(false);
  });
});

describe('ehUltimaTentativa [CA-01.02.16]', () => {
  it('identifica quando resta exatamente uma tentativa', () => {
    expect(ehUltimaTentativa(4, 5)).toBe(true);
  });

  it('não identifica quando restam mais de uma tentativa', () => {
    expect(ehUltimaTentativa(3, 5)).toBe(false);
  });
});

describe('ehElegivelParaBloqueioAutomatico [RN0032]', () => {
  it('conta ATIVA é elegível', () => {
    expect(ehElegivelParaBloqueioAutomatico('ATIVO')).toBe(true);
  });

  it('conta INATIVA não é elegível — bloqueio seria redundante', () => {
    expect(ehElegivelParaBloqueioAutomatico('INATIVO')).toBe(false);
  });
});
