'use server';

import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { getRegistrarExportacaoAnexo6UseCase } from '@/application/use-cases/plano-contas/container';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';

type ActionResult = { sucesso: true } | { sucesso: false; mensagem: string };

const CHAVE_FUNCIONALIDADE = 'orcamentario.anexo6-custo-empregados.visualizar';

/**
 * Só o essencial vem do cliente: QUAL Proposta e QUAL formato. Código, nome e
 * quantitativos são lidos do banco dentro do tenant — trilha de auditoria não
 * pode registrar o que o chamador disser que é (Server Action é endpoint
 * chamável direto, não só pelo botão da tela).
 */
const RegistrarExportacaoAnexo6InputSchema = z.object({
  propostaId: z.string().uuid(),
  formato: z.enum(['PDF', 'XLSX', 'IMPRESSAO']),
});

export type RegistrarExportacaoAnexo6Input = z.infer<typeof RegistrarExportacaoAnexo6InputSchema>;

/**
 * ANEXO 6 — precisa retornar sucesso ANTES de o Client Component liberar a
 * exportação PDF/XLSX/impressão (geração 100% client-side, ADR-037). Se a
 * auditoria falhar, o download é bloqueado — mesma regra do Relatório de
 * Cronograma de Desembolso (US-138, Cenário 8/9).
 */
export async function registrarExportacaoAnexo6Action(input: RegistrarExportacaoAnexo6Input): Promise<ActionResult> {
  const parsed = RegistrarExportacaoAnexo6InputSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, mensagem: 'Requisição inválida.' };

  const { userId } = await auth();
  if (!userId) return { sucesso: false, mensagem: 'Sessão expirada. Faça login novamente.' };

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) return { sucesso: false, mensagem: 'Sessão expirada. Faça login novamente.' };

  // Server Action é endpoint chamável direto — a checagem de permissão da
  // página não basta [code-review 2026-08-20].
  const podeExportar = await usuarioTemFuncionalidade(prisma, tenantId, usuario.id, CHAVE_FUNCIONALIDADE);
  if (!podeExportar) return { sucesso: false, mensagem: 'Sem permissão para exportar o ANEXO 6.' };

  const proposta = await prisma.proposta.findFirst({
    where: { tenantId, id: parsed.data.propostaId },
    select: { id: true, codigo: true, nome: true },
  });
  if (!proposta) return { sucesso: false, mensagem: 'Proposta não encontrada.' };

  const [quantidadeCargos, quantidadeEmpregados] = await Promise.all([
    prisma.cargo.count({ where: { tenantId, propostaId: proposta.id, ativo: true, status: { not: 'RASCUNHO' } } }),
    prisma.empregadoHeadcount.count({ where: { tenantId, propostaId: proposta.id, ativo: true } }),
  ]);

  try {
    await getRegistrarExportacaoAnexo6UseCase().execute({
      tenantId,
      usuarioId: usuario.id,
      propostaCodigo: proposta.codigo,
      propostaNome: proposta.nome,
      formato: parsed.data.formato,
      quantidadeCargos,
      quantidadeEmpregados,
    });
    return { sucesso: true };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao gravar a trilha de auditoria.';
    return { sucesso: false, mensagem };
  }
}
