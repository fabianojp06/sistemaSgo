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
  getCadastrarMetaUseCase,
  getEditarMetaUseCase,
  getExcluirMetaUseCase,
  getCadastrarEmpregadoUseCase,
  getEditarEmpregadoUseCase,
  getExcluirEmpregadoUseCase,
  getConfigurarBeneficiosCargoUseCase,
  getConfigurarElegibilidadeBeneficioUseCase,
  getCadastrarViagemUseCase,
  getEditarViagemUseCase,
  getExcluirViagemUseCase,
  getCadastrarItemPatrimonialUseCase,
  getEditarItemPatrimonialUseCase,
  getExcluirItemPatrimonialUseCase,
  getCadastrarQtdeEmpregadoUseCase,
  getEditarQtdeEmpregadoUseCase,
  getExcluirQtdeEmpregadoUseCase,
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

const StatusMetaSchema = z.enum(['ATIVO', 'INATIVO']);

export type MetaResultado = { id: string; nome: string; valorGlobal: string; status: 'ATIVO' | 'INATIVO' };

const CadastrarMetaSchema = z.object({
  versaoId: z.string().min(1),
  tipo: z.string().trim().min(1),
  nome: z.string().trim().min(1),
  status: StatusMetaSchema,
  observacao: z.string().trim().max(1000).nullable().optional(),
});

/** US-112, Cenários 1-5 — Cadastrar a Meta única de uma VersaoProposta POR_META. */
export async function cadastrarMeta(input: {
  versaoId: string;
  tipo: string;
  nome: string;
  status: 'ATIVO' | 'INATIVO';
  observacao?: string | null;
}): Promise<ActionResultComDados<MetaResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CadastrarMetaSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha Tipo e Status antes de salvar.' };
  }

  try {
    const meta = await getCadastrarMetaUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return { sucesso: true, dados: { id: meta.id, nome: meta.nome, valorGlobal: meta.valorGlobal.toString(), status: meta.status } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const EditarMetaSchema = z.object({
  metaId: z.string().min(1),
  nome: z.string().trim().min(1),
  status: StatusMetaSchema,
  observacao: z.string().trim().max(1000).nullable().optional(),
});

/** US-112, Cenário 6/7 — Editar Meta. Valor Global sempre recalculado no backend. */
export async function editarMeta(input: {
  metaId: string;
  nome: string;
  status: 'ATIVO' | 'INATIVO';
  observacao?: string | null;
}): Promise<ActionResultComDados<MetaResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = EditarMetaSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha Tipo e Status antes de salvar.' };
  }

  try {
    const meta = await getEditarMetaUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return { sucesso: true, dados: { id: meta.id, nome: meta.nome, valorGlobal: meta.valorGlobal.toString(), status: meta.status } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-112, Cenário 8/9 — Excluir Meta (soft delete). */
export async function excluirMeta(metaId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    await getExcluirMetaUseCase().execute({ ...contexto, metaId });
    revalidatePath('/plano-contas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const CategoriaEmpregadoSchema = z.enum(['EMPREGADO', 'ESTAGIARIO', 'JOVEM_APRENDIZ']);

export type EmpregadoResultado = {
  id: string;
  nome: string;
  vinculoFuncionalHerdado: string;
  custoTotalMensal: string;
};

const CadastrarEmpregadoSchema = z.object({
  propostaId: z.string().min(1),
  cargoId: z.string().min(1),
  nome: z.string().trim().nullable().optional(),
  categoria: CategoriaEmpregadoSchema,
  periodoInicio: z.coerce.date(),
  periodoFim: z.coerce.date().nullable().optional(),
});

/** US-108, Cenários 1-5 — Cadastrar Empregado, herdando custo e vínculo do Cargo. */
export async function cadastrarEmpregado(input: {
  propostaId: string;
  cargoId: string;
  nome?: string | null;
  categoria: 'EMPREGADO' | 'ESTAGIARIO' | 'JOVEM_APRENDIZ';
  periodoInicio: string;
  periodoFim?: string | null;
}): Promise<ActionResultComDados<EmpregadoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CadastrarEmpregadoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Selecione um Cargo antes de salvar o empregado.' };
  }

  try {
    const empregado = await getCadastrarEmpregadoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return {
      sucesso: true,
      dados: {
        id: empregado.id,
        nome: empregado.nome,
        vinculoFuncionalHerdado: empregado.vinculoFuncionalHerdado,
        custoTotalMensal: empregado.custoTotalMensal.toString(),
      },
    };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const EditarEmpregadoSchema = z.object({
  empregadoId: z.string().min(1),
  cargoId: z.string().min(1),
  nome: z.string().trim().nullable().optional(),
  categoria: CategoriaEmpregadoSchema,
  periodoInicio: z.coerce.date(),
  periodoFim: z.coerce.date().nullable().optional(),
});

/** US-108, Cenário 6/7 — Editar Empregado. Custo Total Mensal sempre herdado do Cargo. */
export async function editarEmpregado(input: {
  empregadoId: string;
  cargoId: string;
  nome?: string | null;
  categoria: 'EMPREGADO' | 'ESTAGIARIO' | 'JOVEM_APRENDIZ';
  periodoInicio: string;
  periodoFim?: string | null;
}): Promise<ActionResultComDados<EmpregadoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = EditarEmpregadoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Selecione um Cargo antes de salvar o empregado.' };
  }

  try {
    const empregado = await getEditarEmpregadoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return {
      sucesso: true,
      dados: {
        id: empregado.id,
        nome: empregado.nome,
        vinculoFuncionalHerdado: empregado.vinculoFuncionalHerdado,
        custoTotalMensal: empregado.custoTotalMensal.toString(),
      },
    };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-108, Cenário 8/9/10 — Excluir Empregado (soft delete). */
export async function excluirEmpregado(empregadoId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    await getExcluirEmpregadoUseCase().execute({ ...contexto, empregadoId });
    revalidatePath('/plano-contas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const FaixaPlanoSaudeSchema = z.enum(['BASICO', 'INTERMEDIARIO', 'EXECUTIVO']);

const ConfigurarBeneficiosCargoSchema = z.object({
  cargoId: z.string().min(1),
  encargosSociaisPct: z.number().min(0).max(100),
  vaAtivo: z.boolean(),
  vaValorUnitario: z.number().min(0),
  vrAtivo: z.boolean(),
  vrValorUnitario: z.number().min(0),
  planoSaudeAtivo: z.boolean(),
  planoSaudeFaixa: FaixaPlanoSaudeSchema.nullable().optional(),
  planoSaudeValor: z.number().min(0),
  planoOdontoAtivo: z.boolean(),
  planoOdontoValor: z.number().min(0),
  seguroVidaAtivo: z.boolean(),
  seguroVidaValor: z.number().min(0),
  auxilioCrecheAtivo: z.boolean(),
  auxilioCrecheValor: z.number().min(0),
  transporteAtivo: z.boolean(),
  transporteValorUnitario: z.number().min(0),
});

export type BeneficiosCargoResultado = { id: string; custoTotalCargo: string };

/** US-107a — Configurar Encargos e Benefícios (Tabela Mestre) de um Cargo. */
export async function configurarBeneficiosCargo(input: {
  cargoId: string;
  encargosSociaisPct: number;
  vaAtivo: boolean;
  vaValorUnitario: number;
  vrAtivo: boolean;
  vrValorUnitario: number;
  planoSaudeAtivo: boolean;
  planoSaudeFaixa?: 'BASICO' | 'INTERMEDIARIO' | 'EXECUTIVO' | null;
  planoSaudeValor: number;
  planoOdontoAtivo: boolean;
  planoOdontoValor: number;
  seguroVidaAtivo: boolean;
  seguroVidaValor: number;
  auxilioCrecheAtivo: boolean;
  auxilioCrecheValor: number;
  transporteAtivo: boolean;
  transporteValorUnitario: number;
}): Promise<ActionResultComDados<BeneficiosCargoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = ConfigurarBeneficiosCargoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Dados inválidos para configuração de benefícios do cargo.' };
  }

  try {
    const cargo = await getConfigurarBeneficiosCargoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return { sucesso: true, dados: { id: cargo.id, custoTotalCargo: cargo.custoTotalCargo.toString() } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

export type ViagemResultado = {
  id: string;
  descricao: string;
  custoEstimado: string;
};

const CadastrarViagemSchema = z.object({
  versaoId: z.string().min(1),
  descricao: z.string().trim().min(1).max(100),
  quantidadePessoas: z.number().int().positive(),
  mediaDias: z.number().int().positive(),
  custoUnitarioPassagem: z.number().nonnegative(),
  contaPassagemId: z.string().min(1),
  custoUnitarioDiaria: z.number().nonnegative(),
  contaDiariaId: z.string().min(1),
  custoUnitarioTransporte: z.number().nonnegative(),
  contaTransporteId: z.string().min(1),
});

/** US-109, Cenário 1 — Cadastrar Viagem (exige Proposta POR_META com Meta cadastrada). */
export async function cadastrarViagem(input: {
  versaoId: string;
  descricao: string;
  quantidadePessoas: number;
  mediaDias: number;
  custoUnitarioPassagem: number;
  contaPassagemId: string;
  custoUnitarioDiaria: number;
  contaDiariaId: string;
  custoUnitarioTransporte: number;
  contaTransporteId: string;
}): Promise<ActionResultComDados<ViagemResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CadastrarViagemSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha Descrição, Quantidade de Pessoas, Média de Dias e os custos/contas de passagem, diária e transporte.' };
  }

  try {
    const viagem = await getCadastrarViagemUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return { sucesso: true, dados: { id: viagem.id, descricao: viagem.descricao, custoEstimado: viagem.custoEstimado.toString() } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const EditarViagemSchema = z.object({
  viagemId: z.string().min(1),
  descricao: z.string().trim().min(1).max(100),
  quantidadePessoas: z.number().int().positive(),
  mediaDias: z.number().int().positive(),
  custoUnitarioPassagem: z.number().nonnegative(),
  contaPassagemId: z.string().min(1),
  custoUnitarioDiaria: z.number().nonnegative(),
  contaDiariaId: z.string().min(1),
  custoUnitarioTransporte: z.number().nonnegative(),
  contaTransporteId: z.string().min(1),
});

/** US-109, Cenário 4 — Editar Viagem. Vínculos com Proposta/Meta são congelados. */
export async function editarViagem(input: {
  viagemId: string;
  descricao: string;
  quantidadePessoas: number;
  mediaDias: number;
  custoUnitarioPassagem: number;
  contaPassagemId: string;
  custoUnitarioDiaria: number;
  contaDiariaId: string;
  custoUnitarioTransporte: number;
  contaTransporteId: string;
}): Promise<ActionResultComDados<ViagemResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = EditarViagemSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha Descrição, Quantidade de Pessoas, Média de Dias e os custos/contas de passagem, diária e transporte.' };
  }

  try {
    const viagem = await getEditarViagemUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return { sucesso: true, dados: { id: viagem.id, descricao: viagem.descricao, custoEstimado: viagem.custoEstimado.toString() } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-109, Cenário 5/6 — Excluir Viagem (soft delete; bloqueada se Proposta em aprovação). */
export async function excluirViagem(viagemId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    await getExcluirViagemUseCase().execute({ ...contexto, viagemId });
    revalidatePath('/plano-contas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const TipoBeneficioElegibilidadeSchema = z.enum([
  'VA',
  'VR',
  'PLANO_SAUDE',
  'PLANO_ODONTO',
  'SEGURO_VIDA',
  'AUXILIO_CRECHE',
  'VALE_TRANSPORTE',
]);

const ConfigurarElegibilidadeBeneficioSchema = z.object({
  empregadoId: z.string().min(1),
  tipoBeneficio: TipoBeneficioElegibilidadeSchema,
  ativo: z.boolean(),
  periodoInicio: z.coerce.date().nullable().optional(),
  periodoFim: z.coerce.date().nullable().optional(),
  numeroDependentes: z.number().int().nonnegative().optional(),
});

export type ElegibilidadeBeneficioResultado = {
  id: string;
  tipoBeneficio: string;
  ativo: boolean;
  numeroDependentes: number;
};

/** US-108a — Configurar Elegibilidade Individual de um Benefício do Empregado (UC03.28). */
export async function configurarElegibilidadeBeneficio(input: {
  empregadoId: string;
  tipoBeneficio: 'VA' | 'VR' | 'PLANO_SAUDE' | 'PLANO_ODONTO' | 'SEGURO_VIDA' | 'AUXILIO_CRECHE' | 'VALE_TRANSPORTE';
  ativo: boolean;
  periodoInicio?: string | null;
  periodoFim?: string | null;
  numeroDependentes?: number;
}): Promise<ActionResultComDados<ElegibilidadeBeneficioResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = ConfigurarElegibilidadeBeneficioSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Dados inválidos para configuração de elegibilidade de benefício.' };
  }

  try {
    const elegibilidade = await getConfigurarElegibilidadeBeneficioUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return {
      sucesso: true,
      dados: {
        id: elegibilidade.id,
        tipoBeneficio: elegibilidade.tipoBeneficio,
        ativo: elegibilidade.ativo,
        numeroDependentes: elegibilidade.numeroDependentes,
      },
    };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

export type ItemPatrimonialResultado = {
  id: string;
  descricao: string;
  valorTotal: string;
};

const CadastrarItemPatrimonialSchema = z.object({
  versaoId: z.string().min(1),
  contaId: z.string().min(1),
  descricao: z.string().trim().min(1).max(100),
  data: z.coerce.date(),
  quantidade: z.number().int().positive(),
  valorUnitario: z.number().nonnegative(),
});

/** US-110, Cenários 1/2 — Cadastrar Item Patrimonial (Meta obrigatória apenas em Proposta POR_META). */
export async function cadastrarItemPatrimonial(input: {
  versaoId: string;
  contaId: string;
  descricao: string;
  data: Date | string;
  quantidade: number;
  valorUnitario: number;
}): Promise<ActionResultComDados<ItemPatrimonialResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CadastrarItemPatrimonialSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Descrição, Data, Quantidade e Conta Analítica são obrigatórios.' };
  }

  try {
    const item = await getCadastrarItemPatrimonialUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return { sucesso: true, dados: { id: item.id, descricao: item.descricao, valorTotal: item.valorTotal.toString() } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const EditarItemPatrimonialSchema = z.object({
  itemPatrimonialId: z.string().min(1),
  contaId: z.string().min(1),
  descricao: z.string().trim().min(1).max(100),
  data: z.coerce.date(),
  quantidade: z.number().int().positive(),
  valorUnitario: z.number().nonnegative(),
});

/** US-110, Cenário 6 — Editar Item Patrimonial. Vínculos com Proposta/Meta são congelados. */
export async function editarItemPatrimonial(input: {
  itemPatrimonialId: string;
  contaId: string;
  descricao: string;
  data: Date | string;
  quantidade: number;
  valorUnitario: number;
}): Promise<ActionResultComDados<ItemPatrimonialResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = EditarItemPatrimonialSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Descrição, Data, Quantidade e Conta Analítica são obrigatórios.' };
  }

  try {
    const item = await getEditarItemPatrimonialUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return { sucesso: true, dados: { id: item.id, descricao: item.descricao, valorTotal: item.valorTotal.toString() } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-110, Cenário 7 — Excluir Item Patrimonial (soft delete). */
export async function excluirItemPatrimonial(itemPatrimonialId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    await getExcluirItemPatrimonialUseCase().execute({ ...contexto, itemPatrimonialId });
    revalidatePath('/plano-contas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

export type QtdeEmpregadoResultado = {
  id: string;
  numeroDocumento: string;
  quantidadeEmpregados: number;
  quantidadeEstagiarios: number;
  quantidadeJovemAprendiz: number;
};

const CadastrarQtdeEmpregadoSchema = z.object({
  propostaId: z.string().min(1),
  periodoInicio: z.coerce.date(),
  periodoFim: z.coerce.date(),
  numeroDocumento: z.string().trim().min(1),
});

/** US-113, Cenários 1/2/3/4/8 — Cadastrar Qtde. Empregado (quantitativos calculados por COUNT). */
export async function cadastrarQtdeEmpregado(input: {
  propostaId: string;
  periodoInicio: Date | string;
  periodoFim: Date | string;
  numeroDocumento: string;
}): Promise<ActionResultComDados<QtdeEmpregadoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CadastrarQtdeEmpregadoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Período Inicial, Período Final e Número do Documento são obrigatórios.' };
  }

  try {
    const qtdeEmpregado = await getCadastrarQtdeEmpregadoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return {
      sucesso: true,
      dados: {
        id: qtdeEmpregado.id,
        numeroDocumento: qtdeEmpregado.numeroDocumento,
        quantidadeEmpregados: qtdeEmpregado.quantidadeEmpregados,
        quantidadeEstagiarios: qtdeEmpregado.quantidadeEstagiarios,
        quantidadeJovemAprendiz: qtdeEmpregado.quantidadeJovemAprendiz,
      },
    };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const EditarQtdeEmpregadoSchema = z.object({
  qtdeEmpregadoId: z.string().min(1),
  periodoInicio: z.coerce.date(),
  periodoFim: z.coerce.date(),
  numeroDocumento: z.string().trim().min(1),
});

/** US-113, Cenários 5/6 — Editar Qtde. Empregado. Vínculos com Proposta/Meta são congelados. */
export async function editarQtdeEmpregado(input: {
  qtdeEmpregadoId: string;
  periodoInicio: Date | string;
  periodoFim: Date | string;
  numeroDocumento: string;
}): Promise<ActionResultComDados<QtdeEmpregadoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = EditarQtdeEmpregadoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Período Inicial, Período Final e Número do Documento são obrigatórios.' };
  }

  try {
    const qtdeEmpregado = await getEditarQtdeEmpregadoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/plano-contas');
    return {
      sucesso: true,
      dados: {
        id: qtdeEmpregado.id,
        numeroDocumento: qtdeEmpregado.numeroDocumento,
        quantidadeEmpregados: qtdeEmpregado.quantidadeEmpregados,
        quantidadeEstagiarios: qtdeEmpregado.quantidadeEstagiarios,
        quantidadeJovemAprendiz: qtdeEmpregado.quantidadeJovemAprendiz,
      },
    };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-113, Cenário 7 — Excluir Qtde. Empregado (soft delete). */
export async function excluirQtdeEmpregado(qtdeEmpregadoId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    await getExcluirQtdeEmpregadoUseCase().execute({ ...contexto, qtdeEmpregadoId });
    revalidatePath('/plano-contas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}
