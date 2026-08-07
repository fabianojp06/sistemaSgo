'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import { VersaoJaVigenteError } from '@/domain/plano-contas/errors';
import {
  getCadastrarPropostaUseCase,
  getDuplicarPropostaUseCase,
  getExcluirVersaoPropostaUseCase,
  getCriarVersaoPropostaUseCase,
  getRestaurarVersaoPropostaUseCase,
} from '@/application/use-cases/plano-contas/container';

type ActionResult = { sucesso: true } | { sucesso: false; mensagem: string };

type ActionResultComDados<T> = { sucesso: true; dados: T } | { sucesso: false; mensagem: string };

async function usuarioAtual() {
  const { userId } = await auth();
  if (!userId) return null;

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) return null;

  return { tenantId, usuarioId: usuario.id };
}

export type PropostaListada = {
  id: string;
  codigo: string;
  nome: string;
  tipo: 'CONTRATO' | 'TERMO_DE_PARCERIA';
  categoria: 'CONSOLIDADA' | 'POR_META';
  status: string;
  versaoVigenteId: string | null;
  versaoVigenteNumero: number | null;
};

/** US-114 — Listar Propostas (capa + versão vigente, para a tela de entrada do módulo). */
export async function listarPropostas(): Promise<ActionResultComDados<PropostaListada[]>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const propostas = await prisma.proposta.findMany({
    where: { tenantId: contexto.tenantId },
    orderBy: { codigo: 'desc' },
    include: {
      versoes: {
        where: { vigente: true, ativa: true },
        select: { id: true, numeroVersao: true },
        take: 1,
      },
    },
  });

  return {
    sucesso: true,
    dados: propostas.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      tipo: p.tipo,
      categoria: p.categoria,
      status: p.status,
      versaoVigenteId: p.versoes[0]?.id ?? null,
      versaoVigenteNumero: p.versoes[0]?.numeroVersao ?? null,
    })),
  };
}

const CadastrarPropostaSchema = z.object({
  tipo: z.enum(['CONTRATO', 'TERMO_DE_PARCERIA']),
  nome: z.string().trim().min(1),
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
  categoria: z.enum(['CONSOLIDADA', 'POR_META']),
});

export type PropostaCadastradaResultado = { id: string; codigo: string; versaoInicialId: string };

/** US-114/US-102 — Cadastrar Proposta (cria Proposta + Versão 1 atomicamente). */
export async function cadastrarProposta(input: {
  tipo: 'CONTRATO' | 'TERMO_DE_PARCERIA';
  nome: string;
  dataInicio: string;
  dataFim: string;
  categoria: 'CONSOLIDADA' | 'POR_META';
}): Promise<ActionResultComDados<PropostaCadastradaResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CadastrarPropostaSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha todos os campos obrigatórios da Proposta.' };
  }
  if (entrada.data.dataFim.getTime() <= entrada.data.dataInicio.getTime()) {
    return { sucesso: false, mensagem: 'Data Fim deve ser posterior à Data Início.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.criar');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para cadastrar Proposta.' };

  try {
    const proposta = await getCadastrarPropostaUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/propostas');
    return { sucesso: true, dados: { id: proposta.id, codigo: proposta.codigo, versaoInicialId: proposta.versaoInicial.id } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-114/US-104 — Duplicar Proposta (nova Proposta, sempre RASCUNHO/Versão 1). */
export async function duplicarProposta(propostaOrigemId: string): Promise<ActionResultComDados<PropostaCadastradaResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  if (!propostaOrigemId) return { sucesso: false, mensagem: 'Proposta de origem inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.duplicar');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para duplicar Proposta.' };

  try {
    const proposta = await getDuplicarPropostaUseCase().execute({ ...contexto, propostaOrigemId });
    revalidatePath('/propostas');
    return { sucesso: true, dados: { id: proposta.id, codigo: proposta.codigo, versaoInicialId: proposta.versaoInicial.id } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-114/US-103 — Excluir Versão da Proposta (soft delete, ativa=false). */
export async function excluirVersaoProposta(versaoId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  if (!versaoId) return { sucesso: false, mensagem: 'Versão inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.excluir-versao');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para excluir versão de Proposta.' };

  try {
    await getExcluirVersaoPropostaUseCase().execute({ ...contexto, versaoId });
    revalidatePath('/propostas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-119/ADR-033 — Criar Nova Versão de Proposta (copia dados da versão vigente, que fica no histórico). */
export async function criarNovaVersaoProposta(
  propostaId: string,
  descricao?: string,
): Promise<ActionResultComDados<{ versaoId: string; numeroVersao: number }>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  if (!propostaId) return { sucesso: false, mensagem: 'Proposta inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.criar-versao');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para criar nova versão de Proposta.' };

  try {
    const novaVersao = await getCriarVersaoPropostaUseCase().execute({ ...contexto, propostaId, descricao });
    revalidatePath('/propostas');
    return { sucesso: true, dados: { versaoId: novaVersao.id, numeroVersao: novaVersao.numeroVersao } };
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes('Unique constraint')) {
      return { sucesso: false, mensagem: 'Já existe uma nova versão sendo criada para esta Proposta. Atualize a página.' };
    }
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

export type VersaoPropostaHistorico = {
  id: string;
  numeroVersao: number;
  status: string;
  descricao: string | null;
  vigente: boolean;
  ativa: boolean;
  createdAt: Date;
  createdByNome: string;
};

/** US-119/ADR-033 — Listar histórico de versões de uma Proposta (inclui versões excluídas). */
export async function listarVersoesProposta(propostaId: string): Promise<ActionResultComDados<VersaoPropostaHistorico[]>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  if (!propostaId) return { sucesso: false, mensagem: 'Proposta inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.visualizar');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para visualizar Propostas.' };

  const versoes = await prisma.versaoProposta.findMany({
    where: { tenantId: contexto.tenantId, propostaId },
    orderBy: { numeroVersao: 'desc' },
  });

  const autoresIds = [...new Set(versoes.map((v) => v.createdBy))];
  const autores = await prisma.usuario.findMany({
    where: { tenantId: contexto.tenantId, id: { in: autoresIds } },
    select: { id: true, nomeCompleto: true },
  });
  const nomeAutorPorId = new Map(autores.map((a) => [a.id, a.nomeCompleto]));

  return {
    sucesso: true,
    dados: versoes.map((v) => ({
      id: v.id,
      numeroVersao: v.numeroVersao,
      status: v.status,
      descricao: v.descricao,
      vigente: v.vigente,
      ativa: v.ativa,
      createdAt: v.createdAt,
      createdByNome: nomeAutorPorId.get(v.createdBy) ?? 'Desconhecido',
    })),
  };
}

/** US-120/ADR-034 — Restaurar Versão de Proposta (troca a flag vigente, sem copiar dados). */
export async function restaurarVersaoProposta(propostaId: string, versaoRestauradaId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  if (!propostaId || !versaoRestauradaId) return { sucesso: false, mensagem: 'Versão inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.restaurar-versao');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para restaurar versão de Proposta.' };

  try {
    await getRestaurarVersaoPropostaUseCase().execute({ ...contexto, propostaId, versaoRestauradaId });
    revalidatePath('/propostas');
    return { sucesso: true };
  } catch (erro) {
    if (erro instanceof VersaoJaVigenteError) {
      return { sucesso: false, mensagem: erro.message };
    }
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}
