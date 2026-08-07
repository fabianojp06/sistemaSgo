import { Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/db/prisma';
import { montarResumoValorOrcado } from '@/domain/plano-contas/montarResumoValorOrcado';
import { ValorOrcadoContasArvore } from './ValorOrcadoContasArvore';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: Prisma.Decimal | number | string): string {
  return formatadorMoeda.format(Number(valor));
}

/**
 * US-118 — dashboard-resumo da guia Valor Orçado: Valor Global, contas
 * sintéticas com total agregado (expansível) e nº de Empregados da Proposta.
 * Server Component: lê direto do Prisma, sem necessidade de interação para
 * os números — só a árvore expansível (ValorOrcadoContasArvore) é Client.
 */
export async function ValorOrcadoResumoPanel({
  tenantId,
  propostaId,
  versaoId,
  propostaCategoria,
}: {
  tenantId: string;
  propostaId: string;
  versaoId: string;
  propostaCategoria: 'CONSOLIDADA' | 'POR_META';
}) {
  const [valorGlobal, contas, valoresOrcados, totalEmpregados] = await Promise.all([
    obterValorGlobal(tenantId, versaoId, propostaCategoria),
    prisma.contaContabil.findMany({
      where: { tenantId },
      select: { id: true, idPai: true, isAnalitica: true, codigoErp: true, nomeConta: true },
    }),
    prisma.valorOrcadoConta.findMany({
      where: { tenantId, versaoId },
      select: { contaId: true, valor: true },
    }),
    prisma.empregadoHeadcount.count({ where: { tenantId, propostaId, ativo: true } }),
  ]);

  const valorPorContaAnalitica = new Map<string, Prisma.Decimal>();
  for (const linha of valoresOrcados) {
    valorPorContaAnalitica.set(linha.contaId, (valorPorContaAnalitica.get(linha.contaId) ?? new Prisma.Decimal(0)).plus(linha.valor));
  }

  const contasParaResumo = contas.map((c) => ({
    id: c.id,
    idPai: c.idPai,
    isAnalitica: c.isAnalitica,
    label: `${c.codigoErp} — ${c.nomeConta}`,
  }));
  const resumo = montarResumoValorOrcado(contasParaResumo, valorPorContaAnalitica).map(mapearNoParaClient);

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-slate-50 p-4 md:p-6">
      <div className="rounded-xl bg-slate-900 p-5 shadow-md md:p-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-400">Valor Global (total orçado)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{formatarMoeda(valorGlobal)}</p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-400">Nº de Empregados</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{totalEmpregados}</p>
          </div>
        </div>
      </div>

      {resumo.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum valor orçado lançado ainda nesta Versão.</p>
      ) : (
        <ValorOrcadoContasArvore sinteticas={resumo} />
      )}
    </div>
  );
}

type NoClient = { id: string; label: string; total: string; isAnalitica: boolean; filhas: NoClient[] };
type NoServer = { id: string; label: string; total: Prisma.Decimal; isAnalitica: boolean; filhas: NoServer[] };

function mapearNoParaClient(no: NoServer): NoClient {
  return {
    id: no.id,
    label: no.label,
    total: no.total.toString(),
    isAnalitica: no.isAnalitica,
    filhas: no.filhas.map(mapearNoParaClient),
  };
}

/**
 * US-118 — Valor Global: em Proposta POR_META, é Meta.valorGlobal (já
 * espelhado do somatório de ValorOrcadoConta, ADR-017). Em CONSOLIDADA
 * (sem Meta), calculado direto: soma bruta de todas as linhas de
 * ValorOrcadoConta da Versão, todos os exercícios — mesma fórmula, sem
 * depender de Meta existir.
 */
async function obterValorGlobal(tenantId: string, versaoId: string, propostaCategoria: 'CONSOLIDADA' | 'POR_META'): Promise<Prisma.Decimal> {
  if (propostaCategoria === 'POR_META') {
    const meta = await prisma.meta.findFirst({ where: { tenantId, versaoId, ativo: true }, select: { valorGlobal: true } });
    if (meta) return meta.valorGlobal;
  }

  const agregado = await prisma.valorOrcadoConta.aggregate({ where: { tenantId, versaoId }, _sum: { valor: true } });
  return agregado._sum.valor ?? new Prisma.Decimal(0);
}
