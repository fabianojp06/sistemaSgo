'use client';

import { useState } from 'react';

type Barra = { id: string; label: string; valor: number };

/**
 * Gráfico de barras horizontais interativo (SVG puro, sem dependência nova).
 * Cor: azul validado (slot categórico 1 da paleta, ver skill dataviz —
 * `node scripts/validate_palette.js "#2a78d6" --mode light` → PASS). Uso de
 * hue único porque cada barra já é identificada pelo rótulo no eixo — não é
 * comparação de múltiplas séries, então não precisa de legenda.
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

  const alturaLinha = 36;
  const alturaGrafico = ordenadas.length * alturaLinha;
  const larguraRotulo = 200;
  const larguraTotal = 640;
  const larguraBarraMax = larguraTotal - larguraRotulo - 90; // espaço para o valor no fim

  return (
    <div className="rounded border p-4">
      <h4 className="mb-3 text-sm font-medium text-gray-700">{titulo}</h4>
      <svg width="100%" viewBox={`0 0 ${larguraTotal} ${alturaGrafico}`} role="img" aria-label={titulo}>
        {/* Gridlines verticais recessivas em valores redondos */}
        {[0, 0.25, 0.5, 0.75, 1].map((fracao) => (
          <line
            key={fracao}
            x1={larguraRotulo + larguraBarraMax * fracao}
            x2={larguraRotulo + larguraBarraMax * fracao}
            y1={0}
            y2={alturaGrafico}
            stroke="#e1e0d9"
            strokeWidth={1}
          />
        ))}

        {ordenadas.map((barra, i) => {
          const y = i * alturaLinha;
          const largura = (barra.valor / maiorValor) * larguraBarraMax;
          const ativo = ativoId === barra.id;

          return (
            <g
              key={barra.id}
              tabIndex={0}
              onMouseEnter={() => setAtivoId(barra.id)}
              onMouseLeave={() => setAtivoId(null)}
              onFocus={() => setAtivoId(barra.id)}
              onBlur={() => setAtivoId(null)}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              {/* Hit target maior que a barra, cobrindo a linha inteira */}
              <rect x={0} y={y} width={larguraTotal} height={alturaLinha} fill="transparent" />

              <text x={larguraRotulo - 8} y={y + alturaLinha / 2 + 4} textAnchor="end" fontSize={12} fill="#52514e">
                {barra.label}
              </text>

              <rect
                x={larguraRotulo}
                y={y + (alturaLinha - 20) / 2}
                width={Math.max(largura, 2)}
                height={20}
                rx={4}
                fill={ativo ? '#1c5cab' : '#2a78d6'}
              />

              <text
                x={larguraRotulo + largura + 8}
                y={y + alturaLinha / 2 + 4}
                fontSize={12}
                fontWeight={ativo ? 600 : 400}
                fill="#0b0b0b"
              >
                {formatarValor(barra.valor)}
              </text>

              {ativo && (
                <title>
                  {barra.label}: {formatarValor(barra.valor)}
                </title>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
