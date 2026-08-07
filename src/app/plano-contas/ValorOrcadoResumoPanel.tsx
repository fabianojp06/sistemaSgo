import { Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/db/prisma';
import { ValorRealizadoService } from '@/domain/plano-contas/ValorRealizadoService';
import { montarResumoValorOrcado } from '@/domain/plano-contas/montarResumoValorOrcado';
import { ValorOrcadoContasArvore } from './ValorOrcadoContasArvore';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: Prisma.Decimal | number | string): string {
  return formatadorMoeda.format(Number(valor));
}

/**
 * US-118 — dashboard-resumo da guia Valor Orçado: Valor Global, contas
 * sintéticas com total agregado (expansível) e nº de Empregados da Proposta.
 *
 * A guia é só CONSUMIDORA de informação já existente, sem lançamento nem
 * cálculo próprio: Valor Global e a árvore vêm do custo REALIZADO já gerado
 * pela Proposta (Empregados+Viagens+Bens+Rateio de Impostos), o mesmo
 * cálculo do Semáforo (ADR-032, `ValorRealizadoService`) — não do que foi
 * lançado manualmente na guia "Lançar Valor Orçado" (ValorOrcadoConta),
 * que é orçamento/planejamento, conceito diferente de custo já incorrido.
 *
 * Server Component: lê direto do Prisma — só a árvore expansível
 * (ValorOrcadoContasArvore) é Client.
 */
export async function ValorOrcadoResumoPanel({
  tenantId,
  propostaId,
  versaoId,
}: {
  tenantId: string;
  propostaId: string;
  versaoId: string;
}) {
  const [valorPorContaAnalitica, contas, totalEmpregados] = await Promise.all([
    new ValorRealizadoService(prisma).somarPorContaAnalitica(tenantId, versaoId),
    prisma.contaContabil.findMany({
      where: { tenantId },
      select: { id: true, idPai: true, isAnalitica: true, codigoErp: true, nomeConta: true },
    }),
    prisma.empregadoHeadcount.count({ where: { tenantId, propostaId, ativo: true } }),
  ]);

  const valorGlobal = Array.from(valorPorContaAnalitica.values()).reduce((acc, v) => acc.plus(v), new Prisma.Decimal(0));

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
            <p className="text-xs font-medium tracking-wide text-slate-400">Valor Global (custo total já gerado)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{formatarMoeda(valorGlobal)}</p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-400">Nº de Empregados</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{totalEmpregados}</p>
          </div>
        </div>
      </div>

      {resumo.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum custo gerado ainda nesta Proposta (Empregados, Viagens, Bens ou Rateio de Impostos).</p>
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
