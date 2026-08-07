import { Prisma } from '@prisma/client';
import { prisma } from '@/infrastructure/db/prisma';
import { ValorRealizadoService } from '@/domain/plano-contas/ValorRealizadoService';
import { montarResumoValorOrcado } from '@/domain/plano-contas/montarResumoValorOrcado';
import { BarChartHorizontal } from '../propostas/BarChartHorizontal';
import { ValorOrcadoContasArvore } from './ValorOrcadoContasArvore';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: Prisma.Decimal | number | string): string {
  return formatadorMoeda.format(Number(valor));
}

// Paleta categórica validada pela skill dataviz — ordem fixa, mesma já usada em
// EmpregadoPanel.tsx e BadgeSemaforoPanel.tsx (identidade por posição, não hash).
const PALETA_CATEGORICA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

// Mesmos ícones minimalistas inline de EmpregadoPanel.tsx/CargoPanel.tsx — sem dependência de biblioteca de ícones.
function IconeMoeda() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5c0-1.4 1.34-2.5 3-2.5s3 1.1 3 2.5-1.34 2-3 2-3 .6-3 2 1.34 2.5 3 2.5 3-1.1 3-2.5" strokeLinecap="round" />
    </svg>
  );
}
function IconePessoas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * US-118 — dashboard-resumo da guia Valor Orçado: Valor Global, ranking e
 * árvore de contas sintéticas com total agregado, nº de Empregados.
 *
 * A guia é só CONSUMIDORA de informação já existente, sem lançamento nem
 * cálculo próprio: Valor Global e a árvore vêm do custo REALIZADO já gerado
 * pela Proposta (Empregados+Viagens+Bens+Rateio de Impostos), o mesmo
 * cálculo do Semáforo (ADR-032, `ValorRealizadoService`) — não do que foi
 * lançado manualmente na guia "Lançar Valor Orçado" (ValorOrcadoConta),
 * que é orçamento/planejamento, conceito diferente de custo já incorrido.
 *
 * Server Component: lê direto do Prisma — só o gráfico e a árvore
 * expansível (Client Components) precisam de interação.
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

  // Ranking do gráfico = mesmas sintéticas raiz da árvore, cor por posição (identidade, não status).
  const ranking = resumo.map((no, i) => ({
    id: no.id,
    label: no.label,
    valor: Number(no.total),
    cor: PALETA_CATEGORICA[i % PALETA_CATEGORICA.length],
  }));

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-slate-50 p-4 md:p-6">
      <div className="rounded-xl bg-slate-900 p-5 shadow-md md:p-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-400">
              <IconeMoeda />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400">Valor Global (custo total já gerado)</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{formatarMoeda(valorGlobal)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-400">
              <IconePessoas />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400">Nº de Empregados</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{totalEmpregados}</p>
            </div>
          </div>
        </div>
      </div>

      {resumo.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum custo gerado ainda nesta Proposta (Empregados, Viagens, Bens ou Rateio de Impostos).</p>
      ) : (
        <>
          <BarChartHorizontal titulo="Ranking de Contas Sintéticas — Custo Total" barras={ranking} formatarValor={formatarMoeda} />
          <ValorOrcadoContasArvore sinteticas={resumo} />
        </>
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
