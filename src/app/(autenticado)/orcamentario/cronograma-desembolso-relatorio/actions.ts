'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { getRegistrarExportacaoRelatorioCronogramaUseCase } from '@/application/use-cases/plano-contas/container';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';

type ActionResult = { sucesso: true } | { sucesso: false; mensagem: string };

/**
 * US-138, Cenário 8/9 — precisa ser chamada e retornar sucesso ANTES do
 * Client Component liberar a exportação PDF/XLSX/impressão (que é 100%
 * client-side, ADR-037). Se a auditoria falhar, o download é bloqueado.
 */
export async function registrarExportacaoCronogramaAction(input: {
  propostaCodigo: string;
  propostaNome: string;
  formato: 'PDF' | 'XLSX' | 'IMPRESSAO';
  termoAditivoId?: string | null;
  anoExercicio?: number | null;
}): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { sucesso: false, mensagem: 'Sessão expirada. Faça login novamente.' };

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) return { sucesso: false, mensagem: 'Sessão expirada. Faça login novamente.' };

  // [code-review 2026-08-20] Server Actions são endpoints chamáveis diretamente,
  // não só pelo botão da UI — a checagem de permissão da página não basta.
  const podeExportar = await usuarioTemFuncionalidade(
    prisma,
    tenantId,
    usuario.id,
    'orcamentario.cronograma-desembolso-relatorio.visualizar',
  );
  if (!podeExportar) return { sucesso: false, mensagem: 'Sem permissão para exportar o Relatório de Cronograma de Desembolso.' };

  try {
    await getRegistrarExportacaoRelatorioCronogramaUseCase().execute({
      tenantId,
      usuarioId: usuario.id,
      propostaCodigo: input.propostaCodigo,
      propostaNome: input.propostaNome,
      formato: input.formato,
      termoAditivoId: input.termoAditivoId,
      anoExercicio: input.anoExercicio,
    });
    return { sucesso: true };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao gravar a trilha de auditoria.';
    return { sucesso: false, mensagem };
  }
}
