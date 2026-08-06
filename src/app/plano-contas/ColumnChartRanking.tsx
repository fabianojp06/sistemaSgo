'use client';

import { useState } from 'react';

type Coluna = { id: string; label: string; valor: number; cor: string };

/**
 * Gráfico de colunas verticais interativo (SVG puro, sem dependência nova) —
 * ranking de contas por Valor Realizado. Cor por coluna = status do semáforo
 * daquela conta (verde/amarelo/laranja/vermelho/cinza), reaproveitando as
 * mesmas cores já usadas nos badges da lista abaixo — não é identidade
 * categórica (como em Empregados), é o mesmo status já calculado.
 */
export function ColumnChartRanking({ titulo, colunas, formatarValor }: { titulo: string; colunas: Coluna[]; formatarValor: (valor: number) => string }) {
  const [ativoId, setAtivoId] = useState<string | null>(null);

  const ordenadas = [...colunas].sort((a, b) => b.valor - a.valor);
  const maiorValor = Math.max(...ordenadas.map((c) => c.valor), 1);

  const larguraColuna = 48;
  const espacamento = 24;
  const alturaGrafico = 220;
  const alturaEixoRotulos = 56;
  const larguraTotal = ordenadas.length * (larguraColuna + espacamento) + espacamento;
  const alturaTotal = alturaGrafico + alturaEixoRotulos;

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm md:p-5">
      <h4 className="mb-3 text-sm font-semibold text-slate-800">{titulo}</h4>
      <svg width="100%" viewBox={`0 0 ${larguraTotal} ${alturaTotal}`} role="img" aria-label={titulo}>
        {/* Gridlines horizontais recessivas */}
        {[0, 0.25, 0.5, 0.75, 1].map((fracao) => (
          <line
            key={fracao}
            x1={0}
            x2={larguraTotal}
            y1={alturaGrafico * (1 - fracao)}
            y2={alturaGrafico * (1 - fracao)}
            stroke="#e1e0d9"
            strokeWidth={1}
          />
        ))}

        {ordenadas.map((coluna, i) => {
          const x = espacamento + i * (larguraColuna + espacamento);
          const altura = (coluna.valor / maiorValor) * (alturaGrafico - 24);
          const y = alturaGrafico - altura;
          const ativo = ativoId === coluna.id;

          return (
            <g
              key={coluna.id}
              tabIndex={0}
              onMouseEnter={() => setAtivoId(coluna.id)}
              onMouseLeave={() => setAtivoId(null)}
              onFocus={() => setAtivoId(coluna.id)}
              onBlur={() => setAtivoId(null)}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              {/* Hit target maior que a coluna, cobrindo toda a faixa vertical */}
              <rect x={x - espacamento / 2} y={0} width={larguraColuna + espacamento} height={alturaTotal} fill="transparent" />

              <text x={x + larguraColuna / 2} y={y - 8} textAnchor="middle" fontSize={11} fontWeight={ativo ? 600 : 400} fill="#0b0b0b">
                {formatarValor(coluna.valor)}
              </text>

              <rect
                x={x}
                y={y}
                width={larguraColuna}
                height={Math.max(altura, 2)}
                rx={4}
                fill={coluna.cor}
                style={ativo ? { filter: 'brightness(0.85)' } : undefined}
              />

              <text
                x={x + larguraColuna / 2}
                y={alturaGrafico + 20}
                textAnchor="middle"
                fontSize={11}
                fill="#52514e"
                style={{ writingMode: 'horizontal-tb' }}
              >
                {coluna.label.length > 12 ? `${coluna.label.slice(0, 11)}…` : coluna.label}
              </text>

              {ativo && (
                <title>
                  {coluna.label}: {formatarValor(coluna.valor)}
                </title>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
