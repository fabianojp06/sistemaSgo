/**
 * Regras puras de bloqueio de conta [RN0024, RN0026, RN0032, CA-01.02.16, CA-01.05.06/07].
 * Sem I/O — testáveis isoladamente e reutilizadas pelo caso de uso de autenticação.
 */

export type StatusUsuario = 'ATIVO' | 'INATIVO';

/** RN0024 — dispara o bloqueio automático quando o contador atinge o limite configurado. */
export function deveBloquear(contadorFalhas: number, limiteTentativasLogin: number): boolean {
  return contadorFalhas >= limiteTentativasLogin;
}

/** CA-01.02.16 — avisa quando resta exatamente uma tentativa antes do bloqueio. */
export function ehUltimaTentativa(contadorFalhasAposFalha: number, limiteTentativasLogin: number): boolean {
  return contadorFalhasAposFalha === limiteTentativasLogin - 1;
}

/**
 * RN0032 / CA-01.05.07 — bloqueio automático só se aplica a contas ATIVAS.
 * Contas INATIVAS já estão impedidas de autenticar; bloqueá-las seria redundante.
 */
export function ehElegivelParaBloqueioAutomatico(status: StatusUsuario): boolean {
  return status === 'ATIVO';
}
