'use server';

import { guardAdministrador } from './guard';
import { NaoAutorizadoError } from '@/domain/administracao/errors';

export type ActionResult = { sucesso: true; mensagem: string } | { sucesso: false; mensagem: string };

/**
 * US-204 — ADIADO. O reenvio de convite depende do disparo de e-mail, fora de
 * escopo nesta fase (decisão 2026-09-07). Mantido no barrel para o contrato;
 * o guard roda para não deixar um endpoint aberto.
 */
export async function reenviarConvite(usuarioId: string): Promise<ActionResult> {
  try {
    await guardAdministrador();
  } catch (erro) {
    if (erro instanceof NaoAutorizadoError) return { sucesso: false, mensagem: erro.message };
    throw erro;
  }
  void usuarioId;
  return {
    sucesso: false,
    mensagem: 'Reenvio de convite indisponível nesta fase (envio de e-mail não habilitado).',
  };
}
