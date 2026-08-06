'use server';

import { z } from 'zod';
import type { Cargo } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import {
  getCriarUnidadeFuncionalUseCase,
  getInativarUnidadeFuncionalUseCase,
  getCadastrarCargoUseCase,
  getEditarCargoUseCase,
  getConfigurarBeneficiosCargoUseCase,
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

export type UnidadeFuncionalResultado = {
  id: string;
  nome: string;
  tipoNivel: 'SINTETICO_DIRETORIA' | 'SINTETICO_GERENCIA' | 'ANALITICO_ASSESSOR' | 'ANALITICO_COORDENADORIA' | 'ANALITICO_SETOR';
  idPai: string | null;
};

const CriarUnidadeFuncionalSchema = z.object({
  propostaId: z.string().min(1),
  nome: z.string().trim().min(1),
  tipoNivel: z.enum(['SINTETICO_DIRETORIA', 'SINTETICO_GERENCIA', 'ANALITICO_ASSESSOR', 'ANALITICO_COORDENADORIA', 'ANALITICO_SETOR']),
  idPai: z.string().optional(),
});

/** US-116 (UC03.18) — Criar Unidade Funcional (Organograma). */
export async function criarUnidadeFuncional(input: {
  propostaId: string;
  nome: string;
  tipoNivel: UnidadeFuncionalResultado['tipoNivel'];
  idPai?: string;
}): Promise<ActionResultComDados<UnidadeFuncionalResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CriarUnidadeFuncionalSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha todos os campos obrigatórios da Unidade Funcional.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar Estrutura Funcional.' };

  try {
    const unidade = await getCriarUnidadeFuncionalUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/', 'layout'); // invalida toda a árvore de /propostas (não há layout.tsx aninhado ali) — dropdown de Cargo em Empregados, etc.
    return { sucesso: true, dados: { id: unidade.id, nome: unidade.nome, tipoNivel: unidade.tipoNivel, idPai: unidade.idPai } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-116, Cenários 5/6 — Inativar Unidade Funcional. */
export async function inativarUnidadeFuncional(propostaId: string, unidadeId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };
  if (!unidadeId) return { sucesso: false, mensagem: 'Unidade Funcional inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar Estrutura Funcional.' };

  try {
    await getInativarUnidadeFuncionalUseCase().execute({ ...contexto, unidadeId });
    revalidatePath('/', 'layout'); // invalida toda a árvore de /propostas (não há layout.tsx aninhado ali) — dropdown de Cargo em Empregados, etc.
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const AlocacaoSchema = z.object({
  unidadeFuncionalId: z.string().min(1),
  percentual: z.coerce.number(),
});

const CargoDadosSchema = z.object({
  propostaId: z.string().min(1),
  alocacoes: z.array(AlocacaoSchema).min(1),
  contaId: z.string().min(1),
  nomeCargoMercado: z.string().trim().min(1),
  funcaoGratificada: z.coerce.number().nullable().optional(),
  periodoInicio: z.coerce.date(),
  salarioMercadoMinimo: z.coerce.number(),
  salarioMercadoMaximo: z.coerce.number(),
  fonteAtiva: z.enum(['MERCADO_MINIMO', 'MERCADO_MAXIMO', 'RUBI']),
});

export type CargoResultado = {
  id: string;
  codigoCargo: string;
  nomeCargoMercado: string;
  contaId: string;
  fonteAtiva: 'MERCADO_MINIMO' | 'MERCADO_MAXIMO' | 'RUBI';
  salarioMercadoMinimo: string;
  salarioMercadoMaximo: string;
  funcaoGratificada: string | null;
  periodoInicio: string;
  salarioReal: string | null;
  salarioTotal: string;
  custoTotalCargo: string;
  encargosSociaisPct: string;
  vaAtivo: boolean;
  vaValorUnitario: string;
  vrAtivo: boolean;
  vrValorUnitario: string;
  planoSaudeAtivo: boolean;
  planoSaudeFaixa: 'BASICO' | 'INTERMEDIARIO' | 'EXECUTIVO' | null;
  planoSaudeValor: string;
  planoOdontoAtivo: boolean;
  planoOdontoValor: string;
  seguroVidaAtivo: boolean;
  seguroVidaValor: string;
  auxilioCrecheAtivo: boolean;
  auxilioCrecheValor: string;
  transporteAtivo: boolean;
  transporteValorUnitario: string;
};

function serializarCargo(cargo: Cargo): CargoResultado {
  return {
    id: cargo.id,
    codigoCargo: cargo.codigoCargo,
    nomeCargoMercado: cargo.nomeCargoMercado,
    contaId: cargo.contaId,
    fonteAtiva: cargo.fonteAtiva,
    salarioMercadoMinimo: cargo.salarioMercadoMinimo.toString(),
    salarioMercadoMaximo: cargo.salarioMercadoMaximo.toString(),
    funcaoGratificada: cargo.funcaoGratificada?.toString() ?? null,
    periodoInicio: cargo.periodoInicio.toISOString(),
    salarioReal: cargo.salarioReal?.toString() ?? null,
    salarioTotal: cargo.salarioTotal.toString(),
    custoTotalCargo: cargo.custoTotalCargo.toString(),
    encargosSociaisPct: cargo.encargosSociaisPct.toString(),
    vaAtivo: cargo.vaAtivo,
    vaValorUnitario: cargo.vaValorUnitario.toString(),
    vrAtivo: cargo.vrAtivo,
    vrValorUnitario: cargo.vrValorUnitario.toString(),
    planoSaudeAtivo: cargo.planoSaudeAtivo,
    planoSaudeFaixa: cargo.planoSaudeFaixa,
    planoSaudeValor: cargo.planoSaudeValor.toString(),
    planoOdontoAtivo: cargo.planoOdontoAtivo,
    planoOdontoValor: cargo.planoOdontoValor.toString(),
    seguroVidaAtivo: cargo.seguroVidaAtivo,
    seguroVidaValor: cargo.seguroVidaValor.toString(),
    auxilioCrecheAtivo: cargo.auxilioCrecheAtivo,
    auxilioCrecheValor: cargo.auxilioCrecheValor.toString(),
    transporteAtivo: cargo.transporteAtivo,
    transporteValorUnitario: cargo.transporteValorUnitario.toString(),
  };
}

/** US-117 (UC03.19, blocos A/B) — Cadastrar Cargo. */
export async function cadastrarCargo(input: z.input<typeof CargoDadosSchema>): Promise<ActionResultComDados<CargoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CargoDadosSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha todos os campos obrigatórios do Cargo.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar Cargos.' };

  try {
    const cargo = await getCadastrarCargoUseCase().execute({
      ...contexto,
      ...entrada.data,
      funcaoGratificada: entrada.data.funcaoGratificada ?? null,
    });
    revalidatePath('/', 'layout'); // invalida toda a árvore de /propostas (não há layout.tsx aninhado ali) — dropdown de Cargo em Empregados, etc.
    return { sucesso: true, dados: serializarCargo(cargo) };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const EditarCargoSchema = CargoDadosSchema.omit({ propostaId: true }).extend({
  cargoId: z.string().min(1),
  propostaId: z.string().min(1),
});

/** US-117 — Editar Cargo (blocos A/B). */
export async function editarCargo(input: z.input<typeof EditarCargoSchema>): Promise<ActionResultComDados<CargoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = EditarCargoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha todos os campos obrigatórios do Cargo.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar Cargos.' };

  try {
    const { cargoId, ...dados } = entrada.data;
    const cargo = await getEditarCargoUseCase().execute({
      ...contexto,
      cargoId,
      ...dados,
      funcaoGratificada: dados.funcaoGratificada ?? null,
    });
    revalidatePath('/', 'layout'); // invalida toda a árvore de /propostas (não há layout.tsx aninhado ali) — dropdown de Cargo em Empregados, etc.
    return { sucesso: true, dados: serializarCargo(cargo) };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const BeneficiosCargoSchema = z.object({
  propostaId: z.string().min(1),
  cargoId: z.string().min(1),
  encargosSociaisPct: z.coerce.number(),
  vaAtivo: z.boolean(),
  vaValorUnitario: z.coerce.number(),
  vrAtivo: z.boolean(),
  vrValorUnitario: z.coerce.number(),
  planoSaudeAtivo: z.boolean(),
  planoSaudeFaixa: z.enum(['BASICO', 'INTERMEDIARIO', 'EXECUTIVO']).nullable().optional(),
  planoSaudeValor: z.coerce.number(),
  planoOdontoAtivo: z.boolean(),
  planoOdontoValor: z.coerce.number(),
  seguroVidaAtivo: z.boolean(),
  seguroVidaValor: z.coerce.number(),
  auxilioCrecheAtivo: z.boolean(),
  auxilioCrecheValor: z.coerce.number(),
  transporteAtivo: z.boolean(),
  transporteValorUnitario: z.coerce.number(),
});

/** US-107a (bloco C do UC03.19) — Configurar Benefícios e Encargos do Cargo. */
export async function configurarBeneficiosCargo(
  input: z.input<typeof BeneficiosCargoSchema>,
): Promise<ActionResultComDados<CargoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = BeneficiosCargoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha todos os campos obrigatórios de Benefícios do Cargo.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar Cargos.' };

  try {
    const dados = entrada.data;
    const cargo = await getConfigurarBeneficiosCargoUseCase().execute({ ...contexto, ...dados, planoSaudeFaixa: dados.planoSaudeFaixa ?? null });
    revalidatePath('/', 'layout'); // invalida toda a árvore de /propostas (não há layout.tsx aninhado ali) — dropdown de Cargo em Empregados, etc.
    return { sucesso: true, dados: serializarCargo(cargo) };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const SalvarCargoCompletoSchema = CargoDadosSchema.extend({ cargoId: z.string().optional() }).merge(
  BeneficiosCargoSchema.omit({ propostaId: true, cargoId: true }),
);

export type SalvarCargoCompletoResultado =
  | { sucesso: true; dados: CargoResultado }
  | { sucesso: false; mensagem: string; cargoSalvo?: CargoResultado };

/**
 * ADR-028 — orquestra Cadastrar/Editar Cargo + Configurar Benefícios em uma
 * única ação para a UI (um clique, um botão), sem fundir os use cases de
 * domínio (que continuam separados e testados isoladamente). Não é atômico
 * entre as duas escritas: se Cargo salvar e Benefícios falhar, o Cargo NÃO
 * sofre rollback — é um estado válido (benefícios zerados é o default de um
 * Cargo recém-criado) — e o resultado sinaliza sucesso parcial.
 */
export async function salvarCargoCompleto(input: z.input<typeof SalvarCargoCompletoSchema>): Promise<SalvarCargoCompletoResultado> {
  const entrada = SalvarCargoCompletoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha todos os campos obrigatórios do Cargo.' };
  }

  const {
    cargoId,
    encargosSociaisPct,
    vaAtivo,
    vaValorUnitario,
    vrAtivo,
    vrValorUnitario,
    planoSaudeAtivo,
    planoSaudeFaixa,
    planoSaudeValor,
    planoOdontoAtivo,
    planoOdontoValor,
    seguroVidaAtivo,
    seguroVidaValor,
    auxilioCrecheAtivo,
    auxilioCrecheValor,
    transporteAtivo,
    transporteValorUnitario,
    ...dadosCargo
  } = entrada.data;
  const beneficios = {
    encargosSociaisPct,
    vaAtivo,
    vaValorUnitario,
    vrAtivo,
    vrValorUnitario,
    planoSaudeAtivo,
    planoSaudeFaixa,
    planoSaudeValor,
    planoOdontoAtivo,
    planoOdontoValor,
    seguroVidaAtivo,
    seguroVidaValor,
    auxilioCrecheAtivo,
    auxilioCrecheValor,
    transporteAtivo,
    transporteValorUnitario,
  };

  const respostaCargo = cargoId ? await editarCargo({ ...dadosCargo, cargoId }) : await cadastrarCargo(dadosCargo);
  if (!respostaCargo.sucesso) {
    return { sucesso: false, mensagem: respostaCargo.mensagem };
  }

  const respostaBeneficios = await configurarBeneficiosCargo({
    propostaId: dadosCargo.propostaId,
    cargoId: respostaCargo.dados.id,
    ...beneficios,
  });
  if (!respostaBeneficios.sucesso) {
    return {
      sucesso: false,
      mensagem: `Cargo salvo, mas os benefícios não foram salvos: ${respostaBeneficios.mensagem} Edite o Cargo para tentar novamente.`,
      cargoSalvo: respostaCargo.dados,
    };
  }

  return { sucesso: true, dados: respostaBeneficios.dados };
}
