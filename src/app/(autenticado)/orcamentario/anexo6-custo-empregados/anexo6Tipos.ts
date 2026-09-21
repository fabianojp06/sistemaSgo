import type { Anexo6, NivelLinhaAnexo6 } from '@/domain/anexo6/montarAnexo6';

/**
 * `Prisma.Decimal` é instância de classe e não atravessa a fronteira Server
 * Component → Client Component. Mesma solução do Cronograma de Desembolso
 * (cronogramaTipos.ts): o Server Component serializa para string e o Client
 * só formata — nunca refaz conta com `number`.
 */
export type LinhaAnexo6Serializada = {
  codigo: string;
  rotulo: string;
  percentual: string | null;
  nivel: NivelLinhaAnexo6;
  valores: string[];
  total: string;
};

export type BlocoAnexo6Serializado = { codigo: string; titulo: string; linhas: LinhaAnexo6Serializada[] };

export type Anexo6Serializado = {
  colunas: { id: string; nome: string; quantidadeEmpregados: number }[];
  blocos: BlocoAnexo6Serializado[];
  quantidadeTotalEmpregados: number;
};

export function serializarAnexo6(anexo: Anexo6): Anexo6Serializado {
  return {
    colunas: anexo.colunas,
    quantidadeTotalEmpregados: anexo.quantidadeTotalEmpregados,
    blocos: anexo.blocos.map((bloco) => ({
      codigo: bloco.codigo,
      titulo: bloco.titulo,
      linhas: bloco.linhas.map((linha) => ({
        codigo: linha.codigo,
        rotulo: linha.rotulo,
        percentual: linha.percentual?.toFixed(2) ?? null,
        nivel: linha.nivel,
        valores: linha.valores.map((v) => v.toFixed(2)),
        total: linha.total.toFixed(2),
      })),
    })),
  };
}
