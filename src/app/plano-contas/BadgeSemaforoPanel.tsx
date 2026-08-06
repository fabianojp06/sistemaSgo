import { getCalcularValorRealizadoUseCase } from '@/application/use-cases/plano-contas/container';

type ContaOpcao = { id: string; label: string };

const COR_CLASSE: Record<string, string> = {
  VERDE: 'bg-green-100 text-green-800',
  AMARELO: 'bg-yellow-100 text-yellow-800',
  LARANJA: 'bg-orange-100 text-orange-800',
  VERMELHO: 'bg-red-100 text-red-800',
};

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

  return (
    <div className="flex flex-col gap-2 rounded border p-4">
      <h3 className="font-medium">Semáforo Orçamentário</h3>
      <ul className="flex flex-col gap-1">
        {contasAnaliticas.map((conta) => {
          const badge = badges.get(conta.id);
          if (!badge) return null;
          return (
            <li key={conta.id} className="flex items-center gap-2 text-sm">
              <span className="text-gray-700">{conta.label}</span>
              {badge.cor ? (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${COR_CLASSE[badge.cor]}`}>
                  {badge.percentual?.toFixed(1)}% — {badge.cor}
                </span>
              ) : (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                  Sem valor orçado
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
