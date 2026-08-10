import { getCalcularValorRealizadoUseCase } from '@/application/use-cases/plano-contas/container';
import { StackedColumnChartLimite } from './StackedColumnChartLimite';

type ContaOpcao = { id: string; label: string };

const COR_CLASSE: Record<string, string> = {
  VERDE: 'bg-green-100 text-green-800',
  AMARELO: 'bg-yellow-100 text-yellow-800',
  LARANJA: 'bg-orange-100 text-orange-800',
  VERMELHO: 'bg-red-100 text-red-800',
};

// Mesmas cores de status usadas nos badges da lista — o gráfico reforça o status, não é identidade categórica.
const COR_HEX: Record<string, string> = {
  VERDE: '#16a34a',
  AMARELO: '#eab308',
  LARANJA: '#f97316',
  VERMELHO: '#dc2626',
};
const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: number | string): string {
  return formatadorMoeda.format(Number(valor));
}

/**
 * US-008a (ADR-013) + ADR-027 — Badge do Semáforo Orçamentário por conta
 * analítica, na Versão. Server Component: lê diretamente o use case (sem
 * necessidade de interação/formulário, ao contrário dos demais painéis).
 */
export async function BadgeSemaforoPanel({
  tenantId,
  versaoId,
  contasAnaliticas,
}: {
  tenantId: string;
  versaoId: string;
  contasAnaliticas: ContaOpcao[];
}) {
  if (contasAnaliticas.length === 0) {
    return <p className="text-sm text-gray-500">Nenhuma conta analítica disponível.</p>;
  }

  const badges = await getCalcularValorRealizadoUseCase().execute(
    tenantId,
    versaoId,
    contasAnaliticas.map((c) => c.id),
  );

  // Barras empilhadas de limite — só faz sentido para contas com Valor Orçado
  // cadastrado (badge.cor definido), já que a barra representa % consumido
  // de um limite. Contas sem Valor Orçado não têm o que empilhar aqui; elas
  // seguem representadas no ranking categórico acima.
  const barrasLimite = contasAnaliticas
    .map((conta) => ({ conta, badge: badges.get(conta.id) }))
    .filter(
      (c): c is { conta: ContaOpcao; badge: NonNullable<typeof c.badge> } =>
        !!c.badge && c.badge.cor !== null && c.badge.percentual !== null,
    )
    .map(({ conta, badge }) => ({
      id: conta.id,
      label: conta.label,
      valorOrcado: badge.valorOrcado.toNumber(),
      valorRealizado: badge.valorRealizado.toNumber(),
      percentual: badge.percentual!,
      cor: COR_HEX[badge.cor!],
    }));

  // Só contas com valor lançado, decrescente por valor realizado.
  const contasComValor = contasAnaliticas
    .filter((conta) => {
      const badge = badges.get(conta.id);
      return badge && !badge.valorRealizado.isZero();
    })
    .sort((a, b) => {
      const valorA = badges.get(a.id)!.valorRealizado;
      const valorB = badges.get(b.id)!.valorRealizado;
      return valorB.comparedTo(valorA);
    });

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-slate-50 p-4 md:p-6">
      {barrasLimite.length > 0 && (
        <StackedColumnChartLimite titulo="Consumo do Limite por Conta (Valor Orçado)" barras={barrasLimite} />
      )}

      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-slate-800">Semáforo Orçamentário — por Conta Analítica</h3>
        </div>
        {contasComValor.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-500">Nenhuma conta com valor lançado nesta versão.</p>
        )}
        <ul className="divide-y">
          {contasComValor.map((conta) => {
            const badge = badges.get(conta.id)!;
            return (
              <li key={conta.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-slate-100">
                <span className="text-slate-700">{conta.label}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums text-xs text-gray-500">
                    Valor Realizado: {formatarMoeda(badge.valorRealizado.toString())}
                  </span>
                  {badge.cor ? (
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${COR_CLASSE[badge.cor]}`}>
                      {badge.percentual?.toFixed(1)}% — {badge.cor}
                    </span>
                  ) : (
                    <span
                      className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                      title="Não há Valor Orçado cadastrado para esta conta — sem base de comparação para calcular o percentual/cor do semáforo. O Valor Realizado acima está correto e não depende disso."
                    >
                      Valor Orçado: não cadastrado
                    </span>
                  )}
                  {badge.parcial && (
                    <span
                      className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                      title="Valor aproximado — nem todas as fontes de custo conhecidas foram incluídas."
                    >
                      aproximado
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
