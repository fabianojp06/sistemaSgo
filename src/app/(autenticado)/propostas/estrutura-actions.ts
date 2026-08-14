'use server';

import { z } from 'zod';
import { Prisma, type Cargo } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import {
  getCriarUnidadeFuncionalUseCase,
  getInativarUnidadeFuncionalUseCase,
  getImportarEstruturaOrganizacionalUseCase,
  getCadastrarCargoUseCase,
  getCadastrarCargoRascunhoUseCase,
  getEditarCargoUseCase,
  getImportarCargoRubiUseCase,
  getCargoRubiProvider,
  getConfigurarBeneficiosCargoUseCase,
  getRessincronizarSnapshotEmpregadosCargoUseCase,
  getExcluirCargoUseCase,
  getExcluirCargosEmLoteUseCase,
  getListarSenioridadesUseCase,
  getCadastrarSenioridadeUseCase,
  getExcluirSenioridadeUseCase,
  getListarTabelaSalarialUseCase,
  getCadastrarTabelaSalarialUseCase,
  getEditarTabelaSalarialUseCase,
  getExcluirTabelaSalarialUseCase,
} from '@/application/use-cases/plano-contas/container';
import type { RessincronizacaoEmpregadoResultado } from '@/application/use-cases/plano-contas/RessincronizarSnapshotEmpregadosCargoUseCase';
import type { CandidatoCargoRubi } from '@/infrastructure/integrations/rubi/types';
import type { RegistroTabelaSalarial } from '@/application/use-cases/plano-contas/ListarTabelaSalarialUseCase';
import { normalizarValorMonetario } from '@/lib/decimal/normalizarValorMonetario';

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

/** US-130 — Propostas elegíveis como origem de importação: qualquer Proposta com Estrutura Organizacional ativa, exceto a própria destino. */
export async function listarPropostasParaImportarEstrutura(
  propostaDestinoId: string,
): Promise<ActionResultComDados<{ id: string; codigo: string; nome: string }[]>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const propostas = await prisma.proposta.findMany({
    where: {
      tenantId: contexto.tenantId,
      id: { not: propostaDestinoId },
      unidadesFuncionais: { some: { ativa: true } },
    },
    orderBy: { nome: 'asc' },
    select: { id: true, codigo: true, nome: true },
  });
  return { sucesso: true, dados: propostas };
}

const ImportarEstruturaSchema = z.object({
  propostaOrigemId: z.string().min(1),
  propostaDestinoId: z.string().min(1),
});

/** US-130 (ADR-041) — Importar Estrutura Organizacional de outra Proposta, substituindo a existente na destino. */
export async function importarEstruturaOrganizacional(input: {
  propostaOrigemId: string;
  propostaDestinoId: string;
}): Promise<ActionResultComDados<{ unidadesInativadas: number; unidadesCriadas: number }>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = ImportarEstruturaSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Selecione a Proposta de origem.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar Estrutura Funcional.' };

  try {
    const resultado = await getImportarEstruturaOrganizacionalUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/', 'layout');
    return { sucesso: true, dados: resultado };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const CargoDadosSchema = z.object({
  propostaId: z.string().min(1),
  /** ADR-043 — vínculo 1:1 com Unidade Funcional Analítica (RN_CAR_08, custo integral ao setor). */
  unidadeFuncionalId: z.string().min(1),
  contaId: z.string().min(1),
  nomeCargoMercado: z.string().trim().min(1),
  funcaoGratificada: z.coerce.number().nullable().optional(),
  contaGratificacaoId: z.string().nullable().optional(),
  periodoInicio: z.coerce.date(),
  salarioMercadoMinimo: z.coerce.number(),
  salarioMercadoMaximo: z.coerce.number(),
  // US-133, RN_TAB_04/05 — omitido = preserva a origem já persistida (só a UI sabe se o
  // usuário editou manualmente desde o último carregamento).
  origemSalarioMinimo: z.enum(['TABELA_SALARIAL', 'MANUAL']).optional(),
  origemSalarioMaximo: z.enum(['TABELA_SALARIAL', 'MANUAL']).optional(),
  fonteAtiva: z.enum(['MERCADO_MINIMO', 'MERCADO_MAXIMO', 'RUBI']),
});

export type CargoResultado = {
  id: string;
  codigoCargo: string;
  nomeCargoMercado: string;
  // ADR-042 — Cargo Rascunho (status: 'RASCUNHO') ainda não tem esses campos definidos.
  status: 'RASCUNHO' | 'COMPLETO';
  /** ADR-043 — vínculo 1:1 (RN_CAR_08); null só em Cargo Rascunho (ADR-042). */
  unidadeFuncionalId: string | null;
  contaId: string | null;
  fonteAtiva: 'MERCADO_MINIMO' | 'MERCADO_MAXIMO' | 'RUBI' | null;
  salarioMercadoMinimo: string | null;
  salarioMercadoMaximo: string | null;
  origemSalarioMinimo: 'TABELA_SALARIAL' | 'MANUAL';
  origemSalarioMaximo: 'TABELA_SALARIAL' | 'MANUAL';
  funcaoGratificada: string | null;
  contaGratificacaoId: string | null;
  periodoInicio: string | null;
  salarioReal: string | null;
  /** ADR-045 (US-132) — [ORIGEM BLINDADA], preenchidos só via importarCargoRubi. */
  tabSalCodigo: string | null;
  tabSalDescricao: string | null;
  faixaCodigo: string | null;
  faixaDescricao: string | null;
  nivelCodigo: string | null;
  nivelDescricao: string | null;
  statusSyncSalario: 'SINCRONIZADO' | 'PENDENTE' | 'ERRO';
  syncedAt: string | null;
  salarioTotal: string;
  custoTotalCargo: string;
  encargosSociaisPct: string;
  contaEncargosSociaisId: string | null;
  vaAtivo: boolean;
  vaValorUnitario: string;
  contaValeAlimentacaoId: string | null;
  vrAtivo: boolean;
  vrValorUnitario: string;
  contaValeRefeicaoId: string | null;
  planoSaudeAtivo: boolean;
  planoSaudeFaixa: 'BASICO' | 'INTERMEDIARIO' | 'EXECUTIVO' | null;
  planoSaudeValor: string;
  contaPlanoSaudeId: string | null;
  planoOdontoAtivo: boolean;
  planoOdontoValor: string;
  contaPlanoOdontologicoId: string | null;
  seguroVidaAtivo: boolean;
  seguroVidaValor: string;
  contaSeguroVidaId: string | null;
  auxilioCrecheAtivo: boolean;
  auxilioCrecheValor: string;
  contaAuxilioCrecheId: string | null;
  transporteAtivo: boolean;
  transporteValorUnitario: string;
  contaValeTransporteId: string | null;
  periculosidadeAtivo: boolean;
  periculosidadeTipo: 'PERCENTUAL' | 'VALOR_FIXO' | null;
  periculosidadeValor: string;
  contaPericulosidadeId: string | null;
  insalubridadeAtivo: boolean;
  insalubridadeTipo: 'PERCENTUAL' | 'VALOR_FIXO' | null;
  insalubridadeValor: string;
  contaInsalubridadeId: string | null;
};

function serializarCargo(cargo: Cargo): CargoResultado {
  return {
    id: cargo.id,
    codigoCargo: cargo.codigoCargo,
    nomeCargoMercado: cargo.nomeCargoMercado,
    status: cargo.status,
    unidadeFuncionalId: cargo.unidadeFuncionalId,
    contaId: cargo.contaId,
    fonteAtiva: cargo.fonteAtiva,
    salarioMercadoMinimo: cargo.salarioMercadoMinimo?.toString() ?? null,
    salarioMercadoMaximo: cargo.salarioMercadoMaximo?.toString() ?? null,
    origemSalarioMinimo: cargo.origemSalarioMinimo,
    origemSalarioMaximo: cargo.origemSalarioMaximo,
    funcaoGratificada: cargo.funcaoGratificada?.toString() ?? null,
    contaGratificacaoId: cargo.contaGratificacaoId,
    periodoInicio: cargo.periodoInicio?.toISOString() ?? null,
    salarioReal: cargo.salarioReal?.toString() ?? null,
    tabSalCodigo: cargo.tabSalCodigo,
    tabSalDescricao: cargo.tabSalDescricao,
    faixaCodigo: cargo.faixaCodigo,
    faixaDescricao: cargo.faixaDescricao,
    nivelCodigo: cargo.nivelCodigo,
    nivelDescricao: cargo.nivelDescricao,
    statusSyncSalario: cargo.statusSyncSalario,
    syncedAt: cargo.syncedAt?.toISOString() ?? null,
    salarioTotal: cargo.salarioTotal.toString(),
    custoTotalCargo: cargo.custoTotalCargo.toString(),
    encargosSociaisPct: cargo.encargosSociaisPct.toString(),
    contaEncargosSociaisId: cargo.contaEncargosSociaisId,
    vaAtivo: cargo.vaAtivo,
    vaValorUnitario: cargo.vaValorUnitario.toString(),
    contaValeAlimentacaoId: cargo.contaValeAlimentacaoId,
    vrAtivo: cargo.vrAtivo,
    vrValorUnitario: cargo.vrValorUnitario.toString(),
    contaValeRefeicaoId: cargo.contaValeRefeicaoId,
    planoSaudeAtivo: cargo.planoSaudeAtivo,
    planoSaudeFaixa: cargo.planoSaudeFaixa,
    planoSaudeValor: cargo.planoSaudeValor.toString(),
    contaPlanoSaudeId: cargo.contaPlanoSaudeId,
    planoOdontoAtivo: cargo.planoOdontoAtivo,
    planoOdontoValor: cargo.planoOdontoValor.toString(),
    contaPlanoOdontologicoId: cargo.contaPlanoOdontologicoId,
    seguroVidaAtivo: cargo.seguroVidaAtivo,
    seguroVidaValor: cargo.seguroVidaValor.toString(),
    contaSeguroVidaId: cargo.contaSeguroVidaId,
    auxilioCrecheAtivo: cargo.auxilioCrecheAtivo,
    auxilioCrecheValor: cargo.auxilioCrecheValor.toString(),
    contaAuxilioCrecheId: cargo.contaAuxilioCrecheId,
    transporteAtivo: cargo.transporteAtivo,
    transporteValorUnitario: cargo.transporteValorUnitario.toString(),
    contaValeTransporteId: cargo.contaValeTransporteId,
    periculosidadeAtivo: cargo.periculosidadeAtivo,
    periculosidadeTipo: cargo.periculosidadeTipo,
    periculosidadeValor: cargo.periculosidadeValor.toString(),
    contaPericulosidadeId: cargo.contaPericulosidadeId,
    insalubridadeAtivo: cargo.insalubridadeAtivo,
    insalubridadeTipo: cargo.insalubridadeTipo,
    insalubridadeValor: cargo.insalubridadeValor.toString(),
    contaInsalubridadeId: cargo.contaInsalubridadeId,
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

const CargoRascunhoSchema = z.object({
  propostaId: z.string().min(1),
  nomeCargoMercado: z.string().trim().min(1),
});

/**
 * ADR-042 — Cargo "Rascunho": cadastro só com o nome, acionado a partir da aba Tabela
 * Salarial (US-131/US-133). Fica com `status: 'RASCUNHO'` até ser completado na aba
 * Cargos (Vínculo Funcional, Conta, Salário) via `editarCargo`.
 */
export async function cadastrarCargoRascunho(
  input: z.input<typeof CargoRascunhoSchema>,
): Promise<ActionResultComDados<CargoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CargoRascunhoSchema.safeParse(input);
  if (!entrada.success) return { sucesso: false, mensagem: 'Informe o nome do Cargo.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar Cargos.' };

  try {
    const cargo = await getCadastrarCargoRascunhoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/', 'layout');
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
  contaEncargosSociaisId: z.string().nullable().optional(),
  vaAtivo: z.boolean(),
  vaValorUnitario: z.coerce.number(),
  contaValeAlimentacaoId: z.string().nullable().optional(),
  vrAtivo: z.boolean(),
  vrValorUnitario: z.coerce.number(),
  contaValeRefeicaoId: z.string().nullable().optional(),
  planoSaudeAtivo: z.boolean(),
  planoSaudeFaixa: z.enum(['BASICO', 'INTERMEDIARIO', 'EXECUTIVO']).nullable().optional(),
  planoSaudeValor: z.coerce.number(),
  contaPlanoSaudeId: z.string().nullable().optional(),
  planoOdontoAtivo: z.boolean(),
  planoOdontoValor: z.coerce.number(),
  contaPlanoOdontologicoId: z.string().nullable().optional(),
  seguroVidaAtivo: z.boolean(),
  seguroVidaValor: z.coerce.number(),
  contaSeguroVidaId: z.string().nullable().optional(),
  auxilioCrecheAtivo: z.boolean(),
  auxilioCrecheValor: z.coerce.number(),
  contaAuxilioCrecheId: z.string().nullable().optional(),
  transporteAtivo: z.boolean(),
  transporteValorUnitario: z.coerce.number(),
  contaValeTransporteId: z.string().nullable().optional(),
  // ADR-044 — US-136: Periculosidade e Insalubridade.
  periculosidadeAtivo: z.boolean(),
  periculosidadeTipo: z.enum(['PERCENTUAL', 'VALOR_FIXO']).nullable().optional(),
  periculosidadeValor: z.coerce.number(),
  contaPericulosidadeId: z.string().nullable().optional(),
  insalubridadeAtivo: z.boolean(),
  insalubridadeTipo: z.enum(['PERCENTUAL', 'VALOR_FIXO']).nullable().optional(),
  insalubridadeValor: z.coerce.number(),
  contaInsalubridadeId: z.string().nullable().optional(),
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

export type CandidatoCargoRubiResultado = {
  nomeCargoMercado: string;
  tabSalCodigo: string;
  tabSalDescricao: string;
  faixaCodigo: string;
  faixaDescricao: string;
  nivelCodigo: string;
  nivelDescricao: string;
  salarioReal: string;
};

function serializarCandidatoRubi(candidato: CandidatoCargoRubi): CandidatoCargoRubiResultado {
  return { ...candidato, salarioReal: candidato.salarioReal.toString() };
}

const BuscarCargosRubiSchema = z
  .object({
    faixa: z.string().trim().min(1).optional(),
    nivel: z.string().trim().min(1).optional(),
    termo: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.faixa || v.nivel || v.termo, { message: 'Informe ao menos Faixa, Nível ou um termo de busca.' });

/**
 * ADR-046 (US-137) — busca no catálogo persistido (GradeSalarialCtcea): Faixa/Nível
 * como via principal, termo livre como complemento (útil só quando a 2ª fonte de
 * nomes de cargo já tiver chegado). Operação de leitura, não persiste nada.
 */
export async function buscarCargosRubi(
  input: { faixa?: string; nivel?: string; termo?: string },
): Promise<ActionResultComDados<CandidatoCargoRubiResultado[]>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = BuscarCargosRubiSchema.safeParse(input);
  if (!entrada.success) return { sucesso: false, mensagem: 'Informe ao menos Faixa, Nível ou um termo de busca.' };

  try {
    const candidatos = await getCargoRubiProvider().buscarCandidatos({ tenantId: contexto.tenantId, ...entrada.data });
    return { sucesso: true, dados: candidatos.map(serializarCandidatoRubi) };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const ImportarCargoRubiSchema = z.object({
  cargoId: z.string().min(1),
  candidato: z.object({
    nomeCargoMercado: z.string().min(1),
    tabSalCodigo: z.string().min(1),
    tabSalDescricao: z.string().min(1),
    faixaCodigo: z.string().min(1),
    faixaDescricao: z.string().min(1),
    nivelCodigo: z.string().min(1),
    nivelDescricao: z.string().min(1),
    salarioReal: z.coerce.string().transform((v, ctx) => {
      const normalizado = normalizarValorMonetario(v);
      const numero = Number(normalizado);
      if (Number.isNaN(numero) || numero < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Salário Real do candidato inválido.' });
        return z.NEVER;
      }
      return normalizado;
    }),
  }),
});

/**
 * ADR-045 (US-132) — importa, em bloco, os 5 campos [ORIGEM BLINDADA] de um candidato
 * do Rubi já escolhido pelo usuário. Reimportação substitui os 5 campos juntos.
 */
export async function importarCargoRubi(
  input: z.input<typeof ImportarCargoRubiSchema>,
): Promise<ActionResultComDados<CargoResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = ImportarCargoRubiSchema.safeParse(input);
  if (!entrada.success) return { sucesso: false, mensagem: 'Selecione um candidato válido do Rubi.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar Cargos.' };

  try {
    const { cargoId, candidato } = entrada.data;
    const cargo = await getImportarCargoRubiUseCase().execute({
      ...contexto,
      cargoId,
      candidato: { ...candidato, salarioReal: new Prisma.Decimal(candidato.salarioReal) },
    });
    revalidatePath('/', 'layout');
    return { sucesso: true, dados: serializarCargo(cargo) };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/**
 * ADR-030 — ação explícita: re-herda o custo do Cargo (custoTotalMensal,
 * contaId e os 9 componentes/contas de benefício) para os Empregados já
 * cadastrados desse Cargo, quando os benefícios foram alterados depois do
 * cadastro/edição do Empregado. Empregados de Proposta oficializada são
 * ignorados (snapshot congelado por desenho, ADR-018) e reportados como tal.
 */
export async function ressincronizarSnapshotEmpregadosCargo(
  cargoId: string,
): Promise<ActionResultComDados<RessincronizacaoEmpregadoResultado[]>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar Cargos.' };

  try {
    const resultado = await getRessincronizarSnapshotEmpregadosCargoUseCase().execute({ ...contexto, cargoId });
    revalidatePath('/', 'layout'); // invalida toda a árvore de /propostas — Semáforo e Valor Realizado incluídos
    return { sucesso: true, dados: resultado };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** ADR-031 — exclusão individual de Cargo (soft delete), bloqueada se houver Empregado vinculado. */
export async function excluirCargo(cargoId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar Cargos.' };

  try {
    await getExcluirCargoUseCase().execute({ ...contexto, cargoId });
    revalidatePath('/', 'layout');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** ADR-031 — exclusão em lote (tudo-ou-nada); rejeita a operação inteira se algum cargo tiver Empregado vinculado. */
export async function excluirCargosEmLote(propostaId: string, cargoIds: string[]): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar Cargos.' };

  try {
    await getExcluirCargosEmLoteUseCase().execute({ ...contexto, propostaId, cargoIds });
    revalidatePath('/', 'layout');
    return { sucesso: true };
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
    contaEncargosSociaisId,
    vaAtivo,
    vaValorUnitario,
    contaValeAlimentacaoId,
    vrAtivo,
    vrValorUnitario,
    contaValeRefeicaoId,
    planoSaudeAtivo,
    planoSaudeFaixa,
    planoSaudeValor,
    contaPlanoSaudeId,
    planoOdontoAtivo,
    planoOdontoValor,
    contaPlanoOdontologicoId,
    seguroVidaAtivo,
    seguroVidaValor,
    contaSeguroVidaId,
    auxilioCrecheAtivo,
    auxilioCrecheValor,
    contaAuxilioCrecheId,
    transporteAtivo,
    transporteValorUnitario,
    contaValeTransporteId,
    periculosidadeAtivo,
    periculosidadeTipo,
    periculosidadeValor,
    contaPericulosidadeId,
    insalubridadeAtivo,
    insalubridadeTipo,
    insalubridadeValor,
    contaInsalubridadeId,
    ...dadosCargo
  } = entrada.data;
  const beneficios = {
    encargosSociaisPct,
    contaEncargosSociaisId,
    vaAtivo,
    vaValorUnitario,
    contaValeAlimentacaoId,
    vrAtivo,
    vrValorUnitario,
    contaValeRefeicaoId,
    planoSaudeAtivo,
    planoSaudeFaixa,
    planoSaudeValor,
    contaPlanoSaudeId,
    planoOdontoAtivo,
    planoOdontoValor,
    contaPlanoOdontologicoId,
    seguroVidaAtivo,
    seguroVidaValor,
    contaSeguroVidaId,
    auxilioCrecheAtivo,
    auxilioCrecheValor,
    contaAuxilioCrecheId,
    transporteAtivo,
    transporteValorUnitario,
    contaValeTransporteId,
    periculosidadeAtivo,
    periculosidadeTipo,
    periculosidadeValor,
    contaPericulosidadeId,
    insalubridadeAtivo,
    insalubridadeTipo,
    insalubridadeValor,
    contaInsalubridadeId,
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

// US-131 — UC03.19, seção 5. Tabela Salarial de mercado + catálogo de Senioridade.
// Mesma Funcionalidade CONTEXTUAL 'propostas.gerenciar-estrutura' de US-116/117 — a Tabela
// Salarial é acessada a partir da tela de Cargos, sem rota/link próprio no menu.

export type SenioridadeResultado = { id: string; descricao: string; isPadrao: boolean };

/** US-131, seção 5.1 — lista o catálogo de Senioridade (garante Jr/Pl/Sr antes de listar). */
export async function listarSenioridades(): Promise<ActionResultComDados<SenioridadeResultado[]>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    const registros = await getListarSenioridadesUseCase().execute({ tenantId: contexto.tenantId });
    return { sucesso: true, dados: registros.map((r) => ({ id: r.id, descricao: r.descricao, isPadrao: r.isPadrao })) };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const CadastrarSenioridadeSchema = z.object({ descricao: z.string().trim().min(1).max(50) });

/** US-131, Cenário 3 — cadastra Senioridade customizada. */
export async function cadastrarSenioridade(input: { descricao: string }): Promise<ActionResultComDados<SenioridadeResultado>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = CadastrarSenioridadeSchema.safeParse(input);
  if (!entrada.success) return { sucesso: false, mensagem: 'Descrição da Senioridade é obrigatória.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar a Estrutura Funcional.' };

  try {
    const criada = await getCadastrarSenioridadeUseCase().execute({ ...contexto, descricao: entrada.data.descricao });
    revalidatePath('/propostas');
    return { sucesso: true, dados: { id: criada.id, descricao: criada.descricao, isPadrao: criada.isPadrao } };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-131, Cenário 4 [TRAVA O ERRO] — exclui Senioridade customizada sem registro vinculado. */
export async function excluirSenioridade(senioridadeId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar a Estrutura Funcional.' };

  try {
    await getExcluirSenioridadeUseCase().execute({ ...contexto, senioridadeId });
    revalidatePath('/propostas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

export type TabelaSalarialResultado = {
  id: string;
  cargoId: string;
  cargoNome: string;
  cargoCodigo: string;
  senioridadeId: string;
  senioridadeDescricao: string;
  salarioMinimo: string;
  salarioMaximo: string;
};

/** US-131, Cenário 5 / seção 5.2 — lista as faixas de mercado do Cargo em contexto. */
export async function listarTabelaSalarial(cargoId: string): Promise<ActionResultComDados<TabelaSalarialResultado[]>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    const registros = await getListarTabelaSalarialUseCase().execute({ tenantId: contexto.tenantId, cargoId });
    return { sucesso: true, dados: registros.map(serializarTabelaSalarial) };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/**
 * US-131 (melhoria de visualização, pedido do usuário em 2026-08-13) — tela própria da
 * Tabela Salarial, sem escopo de Cargo: lista TODOS os registros do tenant, com filtro por
 * Cargo aplicado no client. Mesma Funcionalidade de leitura NAVEGAVEL 'tabela-salarial.visualizar';
 * mutações continuam sob 'propostas.gerenciar-estrutura' (mesmo domínio de dado do Cargo).
 */
export async function listarTodaTabelaSalarial(): Promise<ActionResultComDados<TabelaSalarialResultado[]>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  try {
    const registros = await getListarTabelaSalarialUseCase().execute({ tenantId: contexto.tenantId });
    return { sucesso: true, dados: registros.map(serializarTabelaSalarial) };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

function serializarTabelaSalarial(r: RegistroTabelaSalarial): TabelaSalarialResultado {
  return {
    id: r.id,
    cargoId: r.cargoId,
    cargoNome: r.cargo.nomeCargoMercado,
    cargoCodigo: r.cargo.codigoCargo,
    senioridadeId: r.senioridadeId,
    senioridadeDescricao: r.senioridade.descricao,
    salarioMinimo: r.salarioMinimo.toString(),
    salarioMaximo: r.salarioMaximo.toString(),
  };
}

const TabelaSalarialFormSchema = z.object({
  cargoId: z.string().min(1),
  senioridadeId: z.string().min(1),
  salarioMinimo: z.string().min(1),
  salarioMaximo: z.string().min(1),
});

type TabelaSalarialFormInput = { cargoId: string; senioridadeId: string; salarioMinimo: string; salarioMaximo: string };

/** US-131, Cenário 1/2 [TRAVA O ERRO] — cadastra faixa de mercado por Cargo + Senioridade. */
export async function cadastrarTabelaSalarial(input: TabelaSalarialFormInput): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = TabelaSalarialFormSchema.safeParse(input);
  if (!entrada.success) return { sucesso: false, mensagem: 'Campos obrigatórios não preenchidos.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar a Estrutura Funcional.' };

  try {
    await getCadastrarTabelaSalarialUseCase().execute({
      ...contexto,
      cargoId: entrada.data.cargoId,
      senioridadeId: entrada.data.senioridadeId,
      salarioMinimo: normalizarValorMonetario(entrada.data.salarioMinimo),
      salarioMaximo: normalizarValorMonetario(entrada.data.salarioMaximo),
    });
    revalidatePath('/propostas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-131 (REQ_TAB_001) [TRAVA O ERRO] — edita Mín/Máx de uma faixa já cadastrada. */
export async function editarTabelaSalarial(
  tabelaSalarialId: string,
  input: { salarioMinimo: string; salarioMaximo: string },
): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = z.object({ salarioMinimo: z.string().min(1), salarioMaximo: z.string().min(1) }).safeParse(input);
  if (!entrada.success) return { sucesso: false, mensagem: 'Campos obrigatórios não preenchidos.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar a Estrutura Funcional.' };

  try {
    await getEditarTabelaSalarialUseCase().execute({
      ...contexto,
      tabelaSalarialId,
      salarioMinimo: normalizarValorMonetario(entrada.data.salarioMinimo),
      salarioMaximo: normalizarValorMonetario(entrada.data.salarioMaximo),
    });
    revalidatePath('/propostas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** US-131 (REQ_TAB_001) — exclui uma faixa de mercado. */
export async function excluirTabelaSalarial(tabelaSalarialId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'propostas.gerenciar-estrutura');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para gerenciar a Estrutura Funcional.' };

  try {
    await getExcluirTabelaSalarialUseCase().execute({ ...contexto, tabelaSalarialId });
    revalidatePath('/propostas');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}
