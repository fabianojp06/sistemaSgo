'use server';

import { guardAdministrador } from './guard';
import { getListarPerfisAtivosUseCase } from '@/application/use-cases/administracao/container';
import { NaoAutorizadoError } from '@/domain/administracao/errors';
import type { PerfilAtivo } from '@/application/use-cases/administracao/dtos';

export type ActionResultComDados<T> = { sucesso: true; dados: T } | { sucesso: false; mensagem: string };

/**
 * US-202 — lista perfis ativos + funcionalidades para os painéis do formulário.
 * FUNDAÇÃO: esqueleto. Corpo real na Frente C.
 */
export async function listarPerfisAtivos(): Promise<ActionResultComDados<PerfilAtivo[]>> {
  try {
    const ctx = await guardAdministrador();
    const dados = await getListarPerfisAtivosUseCase().execute(ctx.tenantId);
    return { sucesso: true, dados };
  } catch (erro) {
    if (erro instanceof NaoAutorizadoError) return { sucesso: false, mensagem: erro.message };
    console.error('[listarPerfisAtivos]', erro);
    return { sucesso: false, mensagem: 'Erro ao carregar perfis.' };
  }
}
