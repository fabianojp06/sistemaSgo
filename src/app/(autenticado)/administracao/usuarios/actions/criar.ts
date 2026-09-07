'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { guardAdministrador } from './guard';
import { getCriarUsuarioUseCase } from '@/application/use-cases/administracao/container';
import {
  CamposObrigatoriosUsuarioError,
  ConviteIdentidadeError,
  EmailInvalidoError,
  EmailJaExisteError,
  LoginJaExisteError,
  NaoAutorizadoError,
  PerfilInvalidoError,
  UsuarioSemPerfilError,
} from '@/domain/administracao/errors';

export type ActionResult =
  | { sucesso: true; mensagem: string }
  | { sucesso: false; mensagem: string; camposInvalidos?: Record<string, string[]> };

const CriarUsuarioSchema = z.object({
  nomeCompleto: z.string().trim().min(1, 'Informe o nome completo.'),
  email: z.string().trim().min(1, 'Informe o e-mail.').email('Informe um e-mail válido.'),
  login: z.string().trim().min(1, 'Informe o login.'),
  status: z.enum(['ATIVO', 'INATIVO']),
  perfis: z.array(z.string().min(1)).min(1, 'Selecione ao menos um perfil de acesso.'),
  excecoes: z
    .array(z.object({ perfilId: z.string().min(1), funcionalidadeId: z.string().min(1) }))
    .default([]),
});

const ERROS_DE_NEGOCIO = [
  CamposObrigatoriosUsuarioError,
  EmailInvalidoError,
  EmailJaExisteError,
  LoginJaExisteError,
  UsuarioSemPerfilError,
  PerfilInvalidoError,
  ConviteIdentidadeError,
] as const;

/** US-201 — Cadastrar Usuário. */
export async function criarUsuario(raw: unknown): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await guardAdministrador();
  } catch (erro) {
    if (erro instanceof NaoAutorizadoError) return { sucesso: false, mensagem: erro.message };
    console.error('[criarUsuario] guard', erro);
    return { sucesso: false, mensagem: 'Erro interno ao cadastrar usuário.' };
  }

  const parsed = CriarUsuarioSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      sucesso: false,
      mensagem: 'Verifique os campos do formulário.',
      camposInvalidos: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { situacaoAcesso } = await getCriarUsuarioUseCase().execute({
      tenantId: ctx.tenantId,
      executorId: ctx.usuarioId,
      clerkSessionId: ctx.clerkSessionId,
      ipEstacao: ctx.ipEstacao,
      ...parsed.data,
    });

    revalidatePath('/administracao/usuarios');
    return {
      sucesso: true,
      mensagem:
        situacaoAcesso === 'CONVITE_PENDENTE'
          ? 'Usuário cadastrado com sucesso. A senha inicial deve ser comunicada ao usuário pelo Administrador.'
          : 'Usuário cadastrado com sucesso.',
    };
  } catch (erro) {
    if (ERROS_DE_NEGOCIO.some((E) => erro instanceof E)) {
      return { sucesso: false, mensagem: (erro as Error).message };
    }
    console.error('[criarUsuario]', erro);
    return { sucesso: false, mensagem: 'Falha ao concluir o cadastro. Nenhuma conta foi criada.' };
  }
}
