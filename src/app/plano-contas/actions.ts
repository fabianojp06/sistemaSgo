'use server';

import { z } from 'zod';
import { Prisma } from '@prisma/client';
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
  getCalcularValorRealizadoUseCase,
  getConfigurarRateioImpostoUseCase,
  getCadastrarCargoUseCase,
  getEditarCargoUseCase,
  getCadastrarMetaUseCase,
  getEditarMetaUseCase,
  getExcluirMetaUseCase,
  getCadastrarEmpregadoUseCase,
  getCadastrarEmpregadosEmLoteUseCase,
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
  getSolicitarTermoAjusteUseCase,
  getAprovarTermoAjusteN1UseCase,
  getHomologarTermoAjusteUseCase,
  getRejeitarTermoAjusteUseCase,
  getListarTermosAjusteUseCase,
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
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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

const ConfigurarRateioImpostoSchema = z.object({
  versaoId: z.string().min(1),
  aliquotaParametroId: z.string().min(1),
  contaId: z.string().min(1),
  competencia: z.coerce.date(),
  valorDeclarado: z.string().min(1),
  tokenConcorrencia: z.coerce.date().optional(),
});

export type RateioImpostoResultado = {
  valorDeclarado: string;
  aliquotaAplicadaSnapshot: string;
};

/** US-101/US-101a — Parametrizar Impostos em Proposta (Rateio de Impostos por conta, ADR-027). */
export async function configurarRateioImposto(input: {
  versaoId: string;
  aliquotaParametroId: string;
  contaId: string;
  competencia: string;
  valorDeclarado: string;
  tokenConcorrencia?: string;
}): Promise<ActionResultComDados<RateioImpostoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = ConfigurarRateioImpostoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha todos os campos obrigatórios do rateio de imposto.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(
    prisma,
    contexto.tenantId,
    contexto.usuarioId,
    'plano-contas.configurar-rateio-imposto',
  );
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para parametrizar impostos.' };

  try {
    const resultado = await getConfigurarRateioImpostoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/', 'layout');
    return {
      sucesso: true,
      dados: {
        valorDeclarado: resultado.valorDeclarado.toString(),
        aliquotaAplicadaSnapshot: resultado.aliquotaAplicadaSnapshot.toString(),
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
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
    return { sucesso: true, dados: { id: novaVersao.id, numeroVersao: novaVersao.numeroVersao } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const FonteAtivaSalarioSchema = z.enum(['MERCADO_MINIMO', 'MERCADO_MAXIMO', 'RUBI']);

const AlocacaoPercentualSchema = z.object({
  unidadeFuncionalId: z.string().min(1),
  percentual: z.number().positive(),
});

const CadastrarCargoSchema = z.object({
  propostaId: z.string().min(1),
  alocacoes: z.array(AlocacaoPercentualSchema).min(1),
  contaId: z.string().min(1),
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

/** US-107, Cenários 1-3/5 — Cadastrar Cargo, com rateio percentual (ADR-026, RN_EST_03) entre nós Analíticos da Estrutura Funcional. */
export async function cadastrarCargo(input: {
  propostaId: string;
  alocacoes: { unidadeFuncionalId: string; percentual: number }[];
  contaId: string;
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
    revalidatePath('/', 'layout');
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
  alocacoes: z.array(AlocacaoPercentualSchema).min(1),
  contaId: z.string().min(1),
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
 * ADR-026 — `alocacoes` substitui integralmente o rateio anterior.
 */
export async function editarCargo(input: {
  cargoId: string;
  alocacoes: { unidadeFuncionalId: string; percentual: number }[];
  contaId: string;
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
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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
  tokenConcorrencia: z.coerce.date().optional(),
});

/** US-112, Cenário 6/7 — Editar Meta. Valor Global sempre recalculado no backend. */
export async function editarMeta(input: {
  metaId: string;
  nome: string;
  status: 'ATIVO' | 'INATIVO';
  observacao?: string | null;
  tokenConcorrencia?: Date;
}): Promise<ActionResultComDados<MetaResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = EditarMetaSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha Tipo e Status antes de salvar.' };
  }

  try {
    const meta = await getEditarMetaUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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
  contaId: string;
  cargoId: string;
  // ADR-029 — snapshot de valor por componente de custo, usado no modal "Detalhes".
  valorSalarioSnapshot: string;
  valorGratificacaoSnapshot: string;
  valorEncargosSociaisSnapshot: string;
  valorValeAlimentacaoSnapshot: string;
  valorValeRefeicaoSnapshot: string;
  valorValeTransporteSnapshot: string;
  valorPlanoOdontologicoSnapshot: string;
  valorSeguroVidaSnapshot: string;
  valorPlanoSaudeSnapshot: string;
  valorAuxilioCrecheSnapshot: string;
};

/** Mapeia o registro completo de EmpregadoHeadcount para o formato exposto ao client. */
function mapearEmpregadoResultado(e: {
  id: string;
  nome: string;
  vinculoFuncionalHerdado: string;
  custoTotalMensal: Prisma.Decimal;
  contaId: string;
  cargoId: string;
  valorSalarioSnapshot: Prisma.Decimal;
  valorGratificacaoSnapshot: Prisma.Decimal;
  valorEncargosSociaisSnapshot: Prisma.Decimal;
  valorValeAlimentacaoSnapshot: Prisma.Decimal;
  valorValeRefeicaoSnapshot: Prisma.Decimal;
  valorValeTransporteSnapshot: Prisma.Decimal;
  valorPlanoOdontologicoSnapshot: Prisma.Decimal;
  valorSeguroVidaSnapshot: Prisma.Decimal;
  valorPlanoSaudeSnapshot: Prisma.Decimal;
  valorAuxilioCrecheSnapshot: Prisma.Decimal;
}): EmpregadoResultado {
  return {
    id: e.id,
    nome: e.nome,
    vinculoFuncionalHerdado: e.vinculoFuncionalHerdado,
    custoTotalMensal: e.custoTotalMensal.toString(),
    contaId: e.contaId,
    cargoId: e.cargoId,
    valorSalarioSnapshot: e.valorSalarioSnapshot.toString(),
    valorGratificacaoSnapshot: e.valorGratificacaoSnapshot.toString(),
    valorEncargosSociaisSnapshot: e.valorEncargosSociaisSnapshot.toString(),
    valorValeAlimentacaoSnapshot: e.valorValeAlimentacaoSnapshot.toString(),
    valorValeRefeicaoSnapshot: e.valorValeRefeicaoSnapshot.toString(),
    valorValeTransporteSnapshot: e.valorValeTransporteSnapshot.toString(),
    valorPlanoOdontologicoSnapshot: e.valorPlanoOdontologicoSnapshot.toString(),
    valorSeguroVidaSnapshot: e.valorSeguroVidaSnapshot.toString(),
    valorPlanoSaudeSnapshot: e.valorPlanoSaudeSnapshot.toString(),
    valorAuxilioCrecheSnapshot: e.valorAuxilioCrecheSnapshot.toString(),
  };
}

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
    revalidatePath('/', 'layout');
    return {
      sucesso: true,
      dados: mapearEmpregadoResultado(empregado),
    };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

export type EmpregadosLoteResultado = {
  empregados: EmpregadoResultado[];
  quantidade: number;
  custoTotalMensal: string;
  totalLote: string;
};

const CadastrarEmpregadosEmLoteSchema = z.object({
  propostaId: z.string().min(1),
  cargoId: z.string().min(1),
  quantidade: z.coerce.number().int().positive(),
  categoria: CategoriaEmpregadoSchema,
  periodoInicio: z.coerce.date(),
  periodoFim: z.coerce.date().nullable().optional(),
});

/** US-108b — Lançamento em Lote de Vagas por Cargo (Quantidade). */
export async function cadastrarEmpregadosEmLote(input: {
  propostaId: string;
  cargoId: string;
  quantidade: number;
  categoria: 'EMPREGADO' | 'ESTAGIARIO' | 'JOVEM_APRENDIZ';
  periodoInicio: string;
  periodoFim?: string | null;
}): Promise<ActionResultComDados<EmpregadosLoteResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CadastrarEmpregadosEmLoteSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Selecione um Cargo e informe uma quantidade válida antes de salvar.' };
  }

  try {
    const empregados = await getCadastrarEmpregadosEmLoteUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/', 'layout');

    const custoTotalMensal = empregados[0]?.custoTotalMensal.toString() ?? '0';
    const totalLote = empregados.reduce((soma, e) => soma.plus(e.custoTotalMensal), new Prisma.Decimal(0)).toString();

    return {
      sucesso: true,
      dados: {
        empregados: empregados.map(mapearEmpregadoResultado),
        quantidade: empregados.length,
        custoTotalMensal,
        totalLote,
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
  tokenConcorrencia: z.coerce.date().optional(),
});

/** US-108, Cenário 6/7 — Editar Empregado. Custo Total Mensal sempre herdado do Cargo. */
export async function editarEmpregado(input: {
  empregadoId: string;
  cargoId: string;
  nome?: string | null;
  categoria: 'EMPREGADO' | 'ESTAGIARIO' | 'JOVEM_APRENDIZ';
  periodoInicio: string;
  periodoFim?: string | null;
  tokenConcorrencia?: Date;
}): Promise<ActionResultComDados<EmpregadoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = EditarEmpregadoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Selecione um Cargo antes de salvar o empregado.' };
  }

  try {
    const empregado = await getEditarEmpregadoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/', 'layout');
    return {
      sucesso: true,
      dados: mapearEmpregadoResultado(empregado),
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
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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
  tokenConcorrencia: z.coerce.date().optional(),
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
  tokenConcorrencia?: Date;
}): Promise<ActionResultComDados<ViagemResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = EditarViagemSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Preencha Descrição, Quantidade de Pessoas, Média de Dias e os custos/contas de passagem, diária e transporte.' };
  }

  try {
    const viagem = await getEditarViagemUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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
  tokenConcorrencia: z.coerce.date().optional(),
});

/** US-110, Cenário 6 — Editar Item Patrimonial. Vínculos com Proposta/Meta são congelados. */
export async function editarItemPatrimonial(input: {
  itemPatrimonialId: string;
  contaId: string;
  descricao: string;
  data: Date | string;
  quantidade: number;
  valorUnitario: number;
  tokenConcorrencia?: Date;
}): Promise<ActionResultComDados<ItemPatrimonialResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = EditarItemPatrimonialSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Descrição, Data, Quantidade e Conta Analítica são obrigatórios.' };
  }

  try {
    const item = await getEditarItemPatrimonialUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
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
  valorTotalConsolidado: string;
};

const CadastrarQtdeEmpregadoSchema = z.object({
  propostaId: z.string().min(1),
  periodoInicio: z.coerce.date(),
  periodoFim: z.coerce.date(),
});

/** US-113, Cenários 1/2/3/4/8 — Cadastrar Qtde. Empregado (quantitativos calculados por COUNT, numeroDocumento gerado automaticamente). */
export async function cadastrarQtdeEmpregado(input: {
  propostaId: string;
  periodoInicio: Date | string;
  periodoFim: Date | string;
}): Promise<ActionResultComDados<QtdeEmpregadoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CadastrarQtdeEmpregadoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Período Inicial e Período Final são obrigatórios.' };
  }

  try {
    const qtdeEmpregado = await getCadastrarQtdeEmpregadoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/', 'layout');
    return {
      sucesso: true,
      dados: {
        id: qtdeEmpregado.id,
        numeroDocumento: qtdeEmpregado.numeroDocumento,
        quantidadeEmpregados: qtdeEmpregado.quantidadeEmpregados,
        quantidadeEstagiarios: qtdeEmpregado.quantidadeEstagiarios,
        quantidadeJovemAprendiz: qtdeEmpregado.quantidadeJovemAprendiz,
        valorTotalConsolidado: qtdeEmpregado.valorTotalConsolidado.toString(),
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
  tokenConcorrencia: z.coerce.date().optional(),
});

/** US-113, Cenários 5/6 — Editar Qtde. Empregado. Vínculos com Proposta/Meta são congelados. */
export async function editarQtdeEmpregado(input: {
  qtdeEmpregadoId: string;
  periodoInicio: Date | string;
  periodoFim: Date | string;
  numeroDocumento: string;
  tokenConcorrencia?: Date;
}): Promise<ActionResultComDados<QtdeEmpregadoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = EditarQtdeEmpregadoSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Período Inicial, Período Final e Número do Documento são obrigatórios.' };
  }

  try {
    const qtdeEmpregado = await getEditarQtdeEmpregadoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/', 'layout');
    return {
      sucesso: true,
      dados: {
        id: qtdeEmpregado.id,
        numeroDocumento: qtdeEmpregado.numeroDocumento,
        quantidadeEmpregados: qtdeEmpregado.quantidadeEmpregados,
        quantidadeEstagiarios: qtdeEmpregado.quantidadeEstagiarios,
        quantidadeJovemAprendiz: qtdeEmpregado.quantidadeJovemAprendiz,
        valorTotalConsolidado: qtdeEmpregado.valorTotalConsolidado.toString(),
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
    revalidatePath('/', 'layout');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const SolicitarTermoAjusteSchema = z.object({
  versaoId: z.string().min(1),
  contaOrigemId: z.string().min(1),
  contaDestinoId: z.string().min(1),
  exercicio: z.number().int().min(2000).max(2100),
  valor: z.string().min(1),
});

export type TermoAjusteResultado = { id: string; status: string; valor: string };

/** US-111 (UC03.13, ADR-025), Cenário 1 — Solicitar Termo de Ajuste entre contas analíticas. */
export async function solicitarTermoAjuste(input: {
  versaoId: string;
  contaOrigemId: string;
  contaDestinoId: string;
  exercicio: number;
  valor: string;
}): Promise<ActionResultComDados<TermoAjusteResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = SolicitarTermoAjusteSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Valor Inválido: informe um valor de ajuste maior que zero.' };
  }

  try {
    const termoAjuste = await getSolicitarTermoAjusteUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/', 'layout');
    return { sucesso: true, dados: { id: termoAjuste.id, status: termoAjuste.status, valor: termoAjuste.valor.toString() } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-111, Cenário 4 (1ª etapa) — Aprovar Termo de Ajuste em 1º nível. */
export async function aprovarTermoAjusteN1(
  termoAjusteId: string,
  tokenConcorrencia?: Date,
): Promise<ActionResultComDados<TermoAjusteResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const temPermissaoAprovarN1 = await usuarioTemFuncionalidade(
    prisma,
    contexto.tenantId,
    contexto.usuarioId,
    'termo-ajuste.aprovar-n1',
  );

  try {
    const termoAjuste = await getAprovarTermoAjusteN1UseCase().execute({
      ...contexto,
      termoAjusteId,
      temPermissaoAprovarN1,
      tokenConcorrencia,
    });
    revalidatePath('/', 'layout');
    return { sucesso: true, dados: { id: termoAjuste.id, status: termoAjuste.status, valor: '' } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-111, Cenário 4 (2ª etapa) / Cenário 5 — Homologar Termo de Ajuste (Gestor Master). */
export async function homologarTermoAjuste(
  termoAjusteId: string,
  tokenConcorrencia?: Date,
): Promise<ActionResultComDados<TermoAjusteResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const temPermissaoGestorMaster = await usuarioTemFuncionalidade(
    prisma,
    contexto.tenantId,
    contexto.usuarioId,
    'termo-ajuste.homologar-gestor-master',
  );

  try {
    const termoAjuste = await getHomologarTermoAjusteUseCase().execute({
      ...contexto,
      termoAjusteId,
      temPermissaoGestorMaster,
      tokenConcorrencia,
    });
    revalidatePath('/', 'layout');
    return { sucesso: true, dados: { id: termoAjuste.id, status: termoAjuste.status, valor: '' } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

export type TermoAjusteListadoResultado = {
  id: string;
  contaOrigemLabel: string;
  contaDestinoLabel: string;
  exercicio: number;
  valor: string;
  status: string;
  updatedAt: string;
};

/** US-111 — lista os Termos de Ajuste de uma Versão de Proposta. */
export async function listarTermosAjuste(versaoId: string): Promise<ActionResultComDados<TermoAjusteListadoResultado[]>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    const termos = await getListarTermosAjusteUseCase().execute(contexto.tenantId, versaoId);
    return {
      sucesso: true,
      dados: termos.map((t) => ({
        id: t.id,
        contaOrigemLabel: t.contaOrigemLabel,
        contaDestinoLabel: t.contaDestinoLabel,
        exercicio: t.exercicio,
        valor: t.valor.toString(),
        status: t.status,
        updatedAt: t.updatedAt.toISOString(),
      })),
    };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-111 — Rejeitar Termo de Ajuste (disponível na etapa N1 ou Gestor Master). */
export async function rejeitarTermoAjuste(
  termoAjusteId: string,
  tokenConcorrencia?: Date,
): Promise<ActionResultComDados<TermoAjusteResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const [temPermissaoAprovarN1, temPermissaoGestorMaster] = await Promise.all([
    usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'termo-ajuste.aprovar-n1'),
    usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'termo-ajuste.homologar-gestor-master'),
  ]);

  try {
    const termoAjuste = await getRejeitarTermoAjusteUseCase().execute({
      ...contexto,
      termoAjusteId,
      temPermissaoAprovarN1,
      temPermissaoGestorMaster,
      tokenConcorrencia,
    });
    revalidatePath('/', 'layout');
    return { sucesso: true, dados: { id: termoAjuste.id, status: termoAjuste.status, valor: '' } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

export type BadgeSemaforoContaResultado = {
  contaId: string;
  valorOrcado: string;
  valorRealizado: string;
  percentual: number | null;
  cor: 'VERDE' | 'AMARELO' | 'LARANJA' | 'VERMELHO' | null;
  /**
   * US-008a — true enquanto valorRealizado não incluir Empregados nem Rateio
   * de Impostos (ambos sem vínculo com ContaContabil no schema atual; ver
   * CalcularValorRealizadoUseCase). Sinaliza ao usuário que o badge é
   * aproximado, não uma promessa de "logo será resolvido automaticamente".
   */
  parcial: boolean;
};

/** US-008a — Badge do Semáforo Orçamentário (valorRealizado por conta, na Versão). */
export async function obterBadgesSemaforo(
  versaoId: string,
  contaIds: string[],
): Promise<ActionResultComDados<BadgeSemaforoContaResultado[]>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    const badges = await getCalcularValorRealizadoUseCase().execute(contexto.tenantId, versaoId, contaIds);
    return {
      sucesso: true,
      dados: Array.from(badges.values()).map((b) => ({
        contaId: b.contaId,
        valorOrcado: b.valorOrcado.toString(),
        valorRealizado: b.valorRealizado.toString(),
        percentual: b.percentual,
        cor: b.cor,
        parcial: b.parcial,
      })),
    };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}
