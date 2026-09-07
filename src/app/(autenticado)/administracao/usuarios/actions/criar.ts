'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { guardAdministrador } from './guard';
import { getCriarUsuarioUseCase } from '@/application/use-cases/administracao/container';
import { NaoAutorizadoError } from '@/domain/administracao/errors';

export type ActionResult = { sucesso: true; mensagem: string } | { sucesso: false; mensagem: string };

const CriarUsuarioSchema = z.object({
  nomeCompleto: z.string().trim().min(1),
  email: z.string().trim().email(),
  login: z.string().trim().min(1),
  status: z.enum(['ATIVO', 'INATIVO']),
  perfis: z.array(z.string().min(1)).min(1),
  excecoes: z
    .array(z.object({ perfilId: z.string().min(1), funcionalidadeId: z.string().min(1) }))
    .default([]),
});

/**
 * US-201 — action de cadastro de usuário. FUNDAÇÃO: esqueleto (guard + validação
 * + wiring do use-case). Corpo de negócio e mensagens finais na Frente B.
 */
export async function criarUsuario(_raw: unknown): Promise<ActionResult> {
  try {
    const _ctx = await guardAdministrador();
    // Frente B: validar com CriarUsuarioSchema, montar CriarUsuarioInput e chamar o use-case.
    void CriarUsuarioSchema;
    void getCriarUsuarioUseCase;
    void revalidatePath;
    return { sucesso: false, mensagem: 'criarUsuario: não implementado (Frente B / US-201).' };
  } catch (erro) {
    if (erro instanceof NaoAutorizadoError) return { sucesso: false, mensagem: erro.message };
    console.error('[criarUsuario]', erro);
    return { sucesso: false, mensagem: 'Erro interno ao cadastrar usuário.' };
  }
}
