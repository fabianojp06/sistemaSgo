'use server';

import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import {
  getListarAliquotasImpostoUseCase,
  getCadastrarAliquotaImpostoUseCase,
  getEditarAliquotaImpostoUseCase,
  getExcluirAliquotaImpostoUseCase,
} from '@/application/use-cases/plano-contas/container';
import type { StatusAliquotaImposto } from '@/application/use-cases/plano-contas/ListarAliquotasImpostoUseCase';
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

export type AliquotaImpostoResultado = {
  id: string;
  nome: string;
  aliquotaPct: string;
  tipoIncidencia: 'CONTRATO' | 'TERMO_DE_PARCERIA' | 'AMBOS';
  dataInicioVigencia: string;
  dataFimVigencia: string | null;
  limiteMinimoPct: string | null;
  limiteMaximoPct: string | null;
  observacao: string | null;
  contaSinteticaId: string | null;
  ativo: boolean;
  status: StatusAliquotaImposto;
  version: number;
  temReferenciaAtiva: boolean;
};

const FiltroSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  tipoIncidencia: z.enum(['CONTRATO', 'TERMO_DE_PARCERIA', 'AMBOS']).optional(),
  status: z.enum(['ATIVO', 'INATIVO', 'EXPIRADA']).optional(),
  vigenciaInicio: z.coerce.date().optional(),
  vigenciaFim: z.coerce.date().optional(),
});

/** UC03.39 — Manter Alíquotas de Impostos (listagem/filtros). */
export async function listarAliquotasImposto(filtro: {
  nome?: string;
  tipoIncidencia?: 'CONTRATO' | 'TERMO_DE_PARCERIA' | 'AMBOS';
  status?: 'ATIVO' | 'INATIVO' | 'EXPIRADA';
  vigenciaInicio?: string;
  vigenciaFim?: string;
} = {}): Promise<ActionResultComDados<AliquotaImpostoResultado[]>> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = FiltroSchema.safeParse(filtro);
  if (!entrada.success) return { sucesso: false, mensagem: 'Filtros inválidos.' };

  try {
    const registros = await getListarAliquotasImpostoUseCase().execute({ tenantId: contexto.tenantId, ...entrada.data });
    return {
      sucesso: true,
      dados: registros.map((r) => ({
        id: r.id,
        nome: r.nome,
        aliquotaPct: r.aliquotaPct.toString(),
        tipoIncidencia: r.tipoIncidencia,
        dataInicioVigencia: r.dataInicioVigencia.toISOString(),
        dataFimVigencia: r.dataFimVigencia?.toISOString() ?? null,
        limiteMinimoPct: r.limiteMinimoPct?.toString() ?? null,
        limiteMaximoPct: r.limiteMaximoPct?.toString() ?? null,
        observacao: r.observacao,
        contaSinteticaId: r.contaSinteticaId,
        ativo: r.ativo,
        status: r.status,
        version: r.version,
        temReferenciaAtiva: r.temReferenciaAtiva,
      })),
    };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

const AliquotaImpostoFormSchema = z
  .object({
    nome: z.string().trim().min(1).max(20),
    aliquotaPct: z.string().min(1),
    tipoIncidencia: z.enum(['CONTRATO', 'TERMO_DE_PARCERIA', 'AMBOS']),
    dataInicioVigencia: z.coerce.date(),
    dataFimVigencia: z.coerce.date().optional().nullable(),
    limiteMinimoPct: z.string().optional().nullable(),
    limiteMaximoPct: z.string().optional().nullable(),
    observacao: z.string().max(500).optional().nullable(),
    contaSinteticaId: z.string().optional().nullable(),
  })
  .transform((v) => ({
    ...v,
    // Bug de QA (mesma causa em Rateio de Impostos): aceitar formato brasileiro "9,25".
    aliquotaPct: normalizarValorMonetario(v.aliquotaPct),
    limiteMinimoPct: v.limiteMinimoPct ? normalizarValorMonetario(v.limiteMinimoPct) : null,
    limiteMaximoPct: v.limiteMaximoPct ? normalizarValorMonetario(v.limiteMaximoPct) : null,
    observacao: v.observacao || null,
    contaSinteticaId: v.contaSinteticaId || null,
    dataFimVigencia: v.dataFimVigencia ?? null,
  }));

type AliquotaImpostoFormInput = {
  nome: string;
  aliquotaPct: string;
  tipoIncidencia: 'CONTRATO' | 'TERMO_DE_PARCERIA' | 'AMBOS';
  dataInicioVigencia: string;
  dataFimVigencia?: string | null;
  limiteMinimoPct?: string | null;
  limiteMaximoPct?: string | null;
  observacao?: string | null;
  contaSinteticaId?: string | null;
};

/** UC03.40 — Cadastrar Alíquota de Imposto. */
export async function cadastrarAliquotaImposto(input: AliquotaImpostoFormInput): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = AliquotaImpostoFormSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Campos obrigatórios não preenchidos. Verifique os campos destacados em vermelho.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'aliquotas-impostos.criar');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para cadastrar alíquotas de impostos.' };

  try {
    await getCadastrarAliquotaImpostoUseCase().execute({ ...contexto, ...entrada.data });
    revalidatePath('/aliquotas-impostos');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** UC03.41 — Alterar Alíquota de Imposto (Optimistic Locking via version). */
export async function editarAliquotaImposto(
  aliquotaImpostoParametroId: string,
  version: number,
  input: AliquotaImpostoFormInput,
): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const entrada = AliquotaImpostoFormSchema.safeParse(input);
  if (!entrada.success) {
    return { sucesso: false, mensagem: 'Campos obrigatórios não preenchidos. Verifique os campos destacados em vermelho.' };
  }

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'aliquotas-impostos.editar');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para editar alíquotas de impostos.' };

  try {
    await getEditarAliquotaImpostoUseCase().execute({
      ...contexto,
      aliquotaImpostoParametroId,
      version,
      ...entrada.data,
    });
    revalidatePath('/aliquotas-impostos');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}

/** UC03.42 — Excluir (Soft Delete) Alíquota de Imposto. */
export async function excluirAliquotaImposto(aliquotaImpostoParametroId: string): Promise<ActionResult> {
  const contexto = await usuarioAtual();
  if (!contexto) return { sucesso: false, mensagem: 'Sessão inválida.' };

  const temPermissao = await usuarioTemFuncionalidade(prisma, contexto.tenantId, contexto.usuarioId, 'aliquotas-impostos.excluir');
  if (!temPermissao) return { sucesso: false, mensagem: 'Perfil sem permissão para excluir alíquotas de impostos.' };

  try {
    await getExcluirAliquotaImpostoUseCase().execute({ ...contexto, aliquotaImpostoParametroId });
    revalidatePath('/aliquotas-impostos');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, mensagem: erro instanceof Error ? erro.message : 'Erro desconhecido.' };
  }
}
