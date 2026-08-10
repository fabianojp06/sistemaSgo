'use client';

import { useState } from 'react';

type Barra = { id: string; label: string; valorOrcado: number; valorRealizado: number; percentual: number; cor: string };

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatadorPct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const COR_TRACK = '#e2e8f0'; // saldo restante do limite
const COR_EXCEDENTE = '#7f1d1d'; // faixa acima de 100% do limite (tom mais escuro que VERMELHO status)

/**
 * Gráfico de colunas empilhadas — % do limite (Valor Orçado) consumido por
 * conta analítica. Cada coluna é normalizada em 100% de altura = Valor
 * Orçado; o segmento colorido (cor de status do Semáforo) é o Valor
 * Realizado, o segmento cinza é o saldo restante. Acima de 100%, a barra
 * satura e ganha uma faixa de excedente destacada no topo — a barra nunca
 * ultrapassa a altura do gráfico, senão a escala das demais colunas quebraria.
 */
export function StackedColumnChartLimite({ titulo, barras }: { titulo: string; barras: Barra[] }) {
  const [ativoId, setAtivoId] = useState<string | null>(null);

  const ordenadas = [...barras].sort((a, b) => b.percentual - a.percentual);

  const larguraColuna = 48;
  const espacamento = 24;
  const alturaGrafico = 320;
  const alturaEixoRotulos = 56;
  const gapSegmento = 2;
  const larguraTotal = ordenadas.length * (larguraColuna + espacamento) + espacamento;
  const alturaTotal = alturaGrafico + alturaEixoRotulos;

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800">{titulo}</h4>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#16a34a' }} />
            Consumido (cor = status do semáforo)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_TRACK }} />
            Saldo restante
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_EXCEDENTE }} />
            Excedente (acima do limite)
          </span>
        </div>
      </div>
      <svg
        width="100%"
        height={alturaTotal}
        viewBox={`0 0 ${larguraTotal} ${alturaTotal}`}
        preserveAspectRatio="xMinYMid meet"
        role="img"
        aria-label={titulo}
      >
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

        {ordenadas.map((barra, i) => {
          const x = espacamento + i * (larguraColuna + espacamento);
          const ativo = ativoId === barra.id;

          const pctConsumido = Math.min(barra.percentual, 100);
          const pctExcedente = Math.max(barra.percentual - 100, 0);
          const alturaConsumido = (pctConsumido / 100) * alturaGrafico;
          const alturaRestante = Math.max(alturaGrafico - alturaConsumido - (alturaConsumido > 0 ? gapSegmento : 0), 0);
          const temExcedente = pctExcedente > 0;

          const yConsumido = alturaGrafico - alturaConsumido;
          const yRestante = 0;

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
              <rect x={x - espacamento / 2} y={0} width={larguraColuna + espacamento} height={alturaTotal} fill="transparent" />

              <text
                x={x + larguraColuna / 2}
                y={yConsumido - 8}
                textAnchor="middle"
                fontSize={11}
                fontWeight={ativo ? 600 : 400}
                fill="#0b0b0b"
              >
                {formatadorPct.format(barra.percentual)}%
              </text>

              {/* Faixa de excedente — pequena marca sólida no topo quando > 100% do limite */}
              {temExcedente && <rect x={x} y={0} width={larguraColuna} height={6} rx={2} fill={COR_EXCEDENTE} />}

              {/* Saldo restante do limite (track cinza) */}
              {alturaRestante > 0 && (
                <rect
                  x={x}
                  y={yRestante + (temExcedente ? 8 : 0)}
                  width={larguraColuna}
                  height={Math.max(alturaRestante - (temExcedente ? 8 : 0), 0)}
                  rx={4}
                  fill={COR_TRACK}
                />
              )}

              {/* Consumido — cor de status do semáforo */}
              <rect
                x={x}
                y={yConsumido}
                width={larguraColuna}
                height={Math.max(alturaConsumido, 2)}
                rx={4}
                fill={barra.cor}
                style={ativo ? { filter: 'brightness(0.85)' } : undefined}
              />

              <text
                x={x + larguraColuna / 2}
                y={alturaGrafico + 20}
                textAnchor="middle"
                fontSize={11}
                fill="#52514e"
              >
                {barra.label.length > 12 ? `${barra.label.slice(0, 11)}…` : barra.label}
              </text>

              {ativo && (
                <title>
                  {barra.label}: {formatadorMoeda.format(barra.valorRealizado)} de {formatadorMoeda.format(barra.valorOrcado)} (
                  {formatadorPct.format(barra.percentual)}%)
                </title>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
