/**
 * US-008a, Cenário 3 — padrão global aplicado a contas sem limiares próprios.
 * Mesmos valores usados como exemplo em toda a documentação do EP118/24 e em
 * RN_TOT_04 da Minuta V5 [ADR-013]. Constante de domínio, não parâmetro por
 * tenant — revisar se algum tenant precisar de um padrão global diferente.
 */
export const LIMIARES_SEMAFORO_PADRAO = { verde: 70, amarelo: 85, laranja: 95 } as const;
