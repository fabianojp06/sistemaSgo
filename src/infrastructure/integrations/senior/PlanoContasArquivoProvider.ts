import type { ContaContabilPayload, PlanoContasProvider } from './types';
import { PLANO_CONTAS_TXT } from './plano-contas-raw';

const CODIGO_REGEX = /^\d+(?:\.\d+)*$/;

/**
 * Fonte do plano de contas exportado do ERP (formato fixo-width, com linhas de
 * cabeçalho/rodapé de página misturadas), embutida como constante em
 * plano-contas-raw.ts — não usa `fs.readFileSync` em runtime porque o caminho
 * relativo a `__dirname` não é confiável em serverless functions (Vercel): o
 * arquivo é rastreado no build (`.nft.json`) mas o bundler não preserva a
 * mesma estrutura de diretórios do `src/`, gerando ENOENT em produção.
 * Substitui o PlanoContasFixtureProvider [decisão ADR do tech lead: mesma
 * interface de saída, troca de fonte é só implementação — integração HTTP
 * real do ERP Senior fica para depois].
 */
export class PlanoContasArquivoProvider implements PlanoContasProvider {
  async buscarContasAtivas(): Promise<ContaContabilPayload[]> {
    return parsePlanoContas(PLANO_CONTAS_TXT);
  }
}

export function parsePlanoContas(conteudo: string): ContaContabilPayload[] {
  const contas: { codigoErp: string; nomeConta: string; nivel: number; isAnalitica: boolean }[] = [];

  for (const linha of conteudo.split('\n')) {
    const tokens = linha.trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 6) continue;

    const codigoErp = tokens[0];
    if (!CODIGO_REGEX.test(codigoErp)) continue;

    const tipo = tokens[tokens.length - 4];
    const nivelToken = tokens[tokens.length - 3];
    if (tipo !== 'S' && tipo !== 'A') continue;
    if (!/^\d+$/.test(nivelToken)) continue;

    const nomeConta = tokens.slice(2, tokens.length - 4).join(' ');
    if (!nomeConta) continue;

    contas.push({
      codigoErp,
      nomeConta,
      nivel: Number(nivelToken),
      isAnalitica: tipo === 'A',
    });
  }

  const codigosExistentes = new Set(contas.map((c) => c.codigoErp));

  return contas.map((conta) => {
    const partes = conta.codigoErp.split('.');
    const codigoPai = partes.slice(0, -1).join('.');
    const codigoPaiErp = codigoPai && codigosExistentes.has(codigoPai) ? codigoPai : null;
    return { ...conta, codigoPaiErp };
  });
}
