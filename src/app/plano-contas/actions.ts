'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import {
  getSincronizarPlanoContasUseCase,
  getCriarAgrupadorUseCase,
  getEditarAgrupadorUseCase,
  getExcluirAgrupadorUseCase,
  getAtribuirNaturezaContaUseCase,
} from '@/application/use-cases/plano-contas/container';

type ActionResult = { sucesso: true } | { sucesso: false; mensagem: string };

async function usuarioAtual() {
  const { userId } = await auth();
  if (!userId) return null;

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) return null;

  return { tenantId, usuarioId: usuario.id };
}

export async function sincronizarPlanoContas(): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const temPermissaoAdministrativa = await usuarioTemFuncionalidade(
    prisma,
    contexto.tenantId,
    contexto.usuarioId,
    'plano-contas.sincronizar',
  );

  try {
    await getSincronizarPlanoContasUseCase().execute({ ...contexto, temPermissaoAdministrativa });
    revalidatePath('/plano-contas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

export async function criarAgrupador(nome: string, contaIds: string[]): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    await getCriarAgrupadorUseCase().execute({ ...contexto, nome, contaIds });
    revalidatePath('/plano-contas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

export async function editarAgrupador(agrupadorId: string, nome: string, contaIds: string[]): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    await getEditarAgrupadorUseCase().execute({ ...contexto, agrupadorId, nome, contaIds });
    revalidatePath('/plano-contas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

export async function atribuirNaturezaConta(contaId: string, natureza: 'OPEX' | 'CAPEX' | null): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(
    prisma,
    contexto.tenantId,
    contexto.usuarioId,
    'plano-contas.classificar-natureza',
  );
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para classificar natureza de conta.' };

  try {
    await getAtribuirNaturezaContaUseCase().execute({ ...contexto, contaId, natureza });
    revalidatePath('/plano-contas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

export async function excluirAgrupador(agrupadorId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    await getExcluirAgrupadorUseCase().execute({ ...contexto, agrupadorId });
    revalidatePath('/plano-contas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}
