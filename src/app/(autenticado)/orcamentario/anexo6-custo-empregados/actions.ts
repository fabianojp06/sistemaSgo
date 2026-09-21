'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { getRegistrarExportacaoAnexo6UseCase } from '@/application/use-cases/plano-contas/container';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';

type ActionResult = { sucesso: true } | { sucesso: false; mensagem: string };

const CHAVE_FUNCIONALIDADE = 'orcamentario.anexo6-custo-empregados.visualizar';

/**
 * ANEXO 6 — precisa retornar sucesso ANTES de o Client Component liberar a
 * exportação PDF/XLSX/impressão (geração 100% client-side, ADR-037). Se a
 * auditoria falhar, o download é bloqueado — mesma regra do Relatório de
 * Cronograma de Desembolso (US-138, Cenário 8/9).
 */
export async function registrarExportacaoAnexo6Action(input: {
  propostaCodigo: string;
  propostaNome: string;
  formato: 'PDF' | 'XLSX' | 'IMPRESSAO';
  quantidadeCargos: number;
  quantidadeEmpregados: number;
}): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { sucesso: false, mensagem: 'Sessão expirada. Faça login novamente.' };

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) return { sucesso: false, mensagem: 'Sessão expirada. Faça login novamente.' };

  // Server Action é endpoint chamável direto, não só pelo botão da UI — a
  // checagem de permissão da página não basta [code-review 2026-08-20].
  const podeExportar = await usuarioTemFuncionalidade(prisma, tenantId, usuario.id, CHAVE_FUNCIONALIDADE);
  if (!podeExportar) return { sucesso: false, mensagem: 'Sem permissão para exportar o ANEXO 6.' };

  try {
    await getRegistrarExportacaoAnexo6UseCase().execute({
      tenantId,
      usuarioId: usuario.id,
      propostaCodigo: input.propostaCodigo,
      propostaNome: input.propostaNome,
      formato: input.formato,
      quantidadeCargos: input.quantidadeCargos,
      quantidadeEmpregados: input.quantidadeEmpregados,
    });
    return { sucesso: true };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao gravar a trilha de auditoria.';
    return { sucesso: false, mensagem };
  }
}
