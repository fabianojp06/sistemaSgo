'use server';

import { revalidatePath } from 'next/cache';
import { guardAdministrador } from './guard';
import { getReenviarConviteUsuarioUseCase } from '@/application/use-cases/administracao/container';
import { NaoAutorizadoError, ReenvioConviteInvalidoError } from '@/domain/administracao/errors';

export type ActionResult = { sucesso: true; mensagem: string } | { sucesso: false; mensagem: string };

/**
 * US-204 — ADIADO (envio de e-mail fora de escopo nesta fase, decisão 2026-09-07).
 * Mantido como esqueleto para não quebrar o barrel de actions.
 */
export async function reenviarConvite(_usuarioId: string): Promise<ActionResult> {
  try {
    const _ctx = await guardAdministrador();
    void getReenviarConviteUsuarioUseCase;
    void revalidatePath;
    void ReenvioConviteInvalidoError;
    return { sucesso: false, mensagem: 'reenviarConvite: não implementado (Frente E / US-204).' };
  } catch (erro) {
    if (erro instanceof NaoAutorizadoError) return { sucesso: false, mensagem: erro.message };
    console.error('[reenviarConvite]', erro);
    return { sucesso: false, mensagem: 'Erro ao reenviar convite.' };
  }
}
