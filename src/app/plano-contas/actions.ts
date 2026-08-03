'use server';

import { z } from 'zod';
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
  getConfigurarValorOrcadoContaUseCase,
  getCriarVersaoPropostaUseCase,
  getConfigurarSemaforoContaUseCase,
  getCadastrarCargoUseCase,
  getEditarCargoUseCase,
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

const ConfigurarValorOrcadoContaSchema = z.object({
  versaoId: z.string().min(1),
  contaId: z.string().min(1),
  exercicio: z.number().int().min(2000).max(2100),
  valor: z.string().min(1),
});

export type ValorOrcadoContaResultado = {
  contaId: string;
  exercicio: number;
  valor: string;
  totaisAncestrais: { contaId: string; total: string }[];
};

/** US-007 — Configurar Valor Orçado por Conta Analítica e Exercício. */
export async function configurarValorOrcadoConta(
  versaoId: string,
  contaId: string,
  exercicio: number,
  valor: string,
): Promise<ActionResultComDados<ValorOrcadoContaResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = ConfigurarValorOrcadoContaSchema.safeParse({ versaoId, contaId, exercicio, valor });
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Valor Inválido: informe um valor monetário maior ou igual a zero.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(
    prisma,
    contexto.tenantId,
    contexto.usuarioId,
    'plano-contas.configurar-valor-orcado',
  );
  if (!temPermissao) return { sucesso: false, mensagem: 'Você não tem permissão para configurar valores orçados.' };

  try {
    const resultado = await getConfigurarValorOrcadoContaUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return {
      sucesso: true,
      dados: {
        contaId: resultado.contaId,
        exercicio: resultado.exercicio,
        valor: resultado.valor.toString(),
        totaisAncestrais: resultado.totaisAncestrais.map((t) => ({ contaId: t.contaId, total: t.total.toString() })),
      },
    };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const ConfigurarSemaforoContaSchema = z.object({
  contaId: z.string().min(1),
  limiares: z
    .object({
      verde: z.number().int().min(1).max(100),
      amarelo: z.number().int().min(1).max(100),
      laranja: z.number().int().min(1).max(100),
    })
    .nullable(),
});

/** US-008 — Configurar Semáforo Orçamentário por Conta Analítica. */
export async function configurarSemaforoConta(
  contaId: string,
  limiares: { verde: number; amarelo: number; laranja: number } | null,
): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = ConfigurarSemaforoContaSchema.safeParse({ contaId, limiares });
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Configuração Inválida: os percentuais devem estar entre 1 e 100.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(
    prisma,
    contexto.tenantId,
    contexto.usuarioId,
    'plano-contas.configurar-semaforo',
  );
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para configurar semáforo orçamentário.' };

  try {
    await getConfigurarSemaforoContaUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const CriarVersaoPropostaSchema = z.object({
  propostaId: z.string().min(1),
  descricao: z.string().trim().max(500).optional(),
});

export type VersaoPropostaResultado = { id: string; numeroVersao: number };

/** US-007, Cenário 4 — cria nova versão de Proposta copiando os valores orçados da vigente. */
export async function criarVersaoProposta(
  propostaId: string,
  descricao?: string,
): Promise<ActionResultComDados<VersaoPropostaResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CriarVersaoPropostaSchema.safeParse({ propostaId, descricao });
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Dados inválidos para criação de nova versão.' };
  }

  try {
    const novaVersao = await getCriarVersaoPropostaUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return { sucesso: true, dados: { id: novaVersao.id, numeroVersao: novaVersao.numeroVersao } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const FonteAtivaSalarioSchema = z.enum(['MERCADO_MINIMO', 'MERCADO_MAXIMO', 'RUBI']);

const CadastrarCargoSchema = z.object({
  propostaId: z.string().min(1),
  unidadeFuncionalId: z.string().min(1),
  nomeCargoMercado: z.string().trim().min(1),
  funcaoGratificada: z.number().nonnegative().nullable().optional(),
  periodoInicio: z.coerce.date(),
  salarioMercadoMinimo: z.number().nonnegative(),
  salarioMercadoMaximo: z.number().nonnegative(),
  fonteAtiva: FonteAtivaSalarioSchema,
});

export type CargoResultado = {
  id: string;
  codigoCargo: string;
  salarioReal: string | null;
  salarioTotal: string;
};

/** US-107, Cenários 1-3/5 — Cadastrar Cargo vinculado a um nó Analítico da Estrutura Funcional. */
export async function cadastrarCargo(input: {
  propostaId: string;
  unidadeFuncionalId: string;
  nomeCargoMercado: string;
  funcaoGratificada?: number | null;
  periodoInicio: string;
  salarioMercadoMinimo: number;
  salarioMercadoMaximo: number;
  fonteAtiva: 'MERCADO_MINIMO' | 'MERCADO_MAXIMO' | 'RUBI';
}): Promise<ActionResultComDados<CargoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CadastrarCargoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha todos os campos obrigatórios do cargo antes de salvar.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'plano-contas.cargo-criar');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para cadastrar cargo.' };

  try {
    const cargo = await getCadastrarCargoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return {
      sucesso: true,
      dados: {
        id: cargo.id,
        codigoCargo: cargo.codigoCargo,
        salarioReal: cargo.salarioReal?.toString() ?? null,
        salarioTotal: cargo.salarioTotal.toString(),
      },
    };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const EditarCargoSchema = z.object({
  cargoId: z.string().min(1),
  unidadeFuncionalId: z.string().min(1),
  nomeCargoMercado: z.string().trim().min(1),
  funcaoGratificada: z.number().nonnegative().nullable().optional(),
  periodoInicio: z.coerce.date(),
  salarioMercadoMinimo: z.number().nonnegative(),
  salarioMercadoMaximo: z.number().nonnegative(),
  fonteAtiva: FonteAtivaSalarioSchema,
});

/**
 * US-107, Cenário 4 — Editar Cargo. Qualquer `salarioReal` enviado pelo
 * client é ignorado pelo use case (campo soberano do provider Rubi).
 */
export async function editarCargo(input: {
  cargoId: string;
  unidadeFuncionalId: string;
  nomeCargoMercado: string;
  funcaoGratificada?: number | null;
  periodoInicio: string;
  salarioMercadoMinimo: number;
  salarioMercadoMaximo: number;
  fonteAtiva: 'MERCADO_MINIMO' | 'MERCADO_MAXIMO' | 'RUBI';
}): Promise<ActionResultComDados<CargoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = EditarCargoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha todos os campos obrigatórios do cargo antes de salvar.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'plano-contas.cargo-editar');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para editar cargo.' };

  try {
    const cargo = await getEditarCargoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return {
      sucesso: true,
      dados: {
        id: cargo.id,
        codigoCargo: cargo.codigoCargo,
        salarioReal: cargo.salarioReal?.toString() ?? null,
        salarioTotal: cargo.salarioTotal.toString(),
      },
    };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}
