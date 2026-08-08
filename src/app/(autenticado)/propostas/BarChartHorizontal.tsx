'use client';

import { useState } from 'react';

type Barra = { id: string; label: string; valor: number; cor: string };

/**
 * Gráfico de barras horizontais (HTML/CSS puro, sem SVG e sem dependência
 * nova). Reescrito nesta sessão: a versão anterior usava um SVG com viewBox
 * de largura fixa (640px) e uma faixa de rótulo também fixa (200px) — como o
 * SVG escala em bloco pelo aspect ratio do viewBox, qualquer variação no
 * número de barras (ranking por nível, US-121) distorcia a proporção do
 * gráfico inteiro, e rótulos de conta mais longos que 200px eram cortados
 * sem qualquer aviso visual (vazavam para fora da área do SVG). Com
 * flexbox, cada linha ocupa a largura real do container (responsivo de
 * verdade) e o rótulo usa `truncate` do Tailwind (reticências + `title`
 * com o texto completo no hover), em vez de cortar sem indicar que cortou.
 */
export function BarChartHorizontal({
  titulo,
  barras,
  formatarValor,
}: {
  titulo: string;
  barras: Barra[];
  formatarValor: (valor: number) => string;
}) {
  const [ativoId, setAtivoId] = useState<string | null>(null);

  const ordenadas = [...barras].sort((a, b) => b.valor - a.valor);
  const maiorValor = Math.max(...ordenadas.map((b) => b.valor), 1);

  return (
    <div className="rounded border p-4">
      <h4 className="mb-3 text-sm font-medium text-gray-700">{titulo}</h4>
      <div className="flex max-h-[520px] flex-col gap-1.5 overflow-y-auto pr-1">
        {ordenadas.map((barra) => {
          const percentual = Math.max((barra.valor / maiorValor) * 100, 1.5);
          const ativo = ativoId === barra.id;

          return (
            <div
              key={barra.id}
              className="grid grid-cols-[minmax(0,200px)_1fr] items-center gap-2 rounded px-1 py-1 hover:bg-gray-50"
              onMouseEnter={() => setAtivoId(barra.id)}
              onMouseLeave={() => setAtivoId(null)}
              onFocus={() => setAtivoId(barra.id)}
              onBlur={() => setAtivoId(null)}
              tabIndex={0}
              title={`${barra.label}: ${formatarValor(barra.valor)}`}
            >
              <span className="truncate text-right text-xs text-gray-600" title={barra.label}>
                {barra.label}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-4 min-w-0 flex-1 rounded bg-gray-100">
                  <div
                    className="h-full rounded transition-[width]"
                    style={{
                      width: `${percentual}%`,
                      backgroundColor: barra.cor,
                      filter: ativo ? 'brightness(0.85)' : undefined,
                    }}
                  />
                </div>
                <span className={`w-24 flex-shrink-0 text-xs tabular-nums text-gray-900 ${ativo ? 'font-semibold' : ''}`}>
                  {formatarValor(barra.valor)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
