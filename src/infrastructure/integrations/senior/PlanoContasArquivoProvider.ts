import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ContaContabilPayload, PlanoContasProvider } from './types';

const CODIGO_REGEX = /^\d+(?:\.\d+)*$/;

/**
 * Lê o plano de contas de um arquivo `.txt` exportado do ERP (formato fixo-width,
 * com linhas de cabeçalho/rodapé de página misturadas). Substitui o
 * PlanoContasFixtureProvider [decisão ADR do tech lead: mesma interface de saída,
 * troca de fonte é só implementação — integração HTTP real do ERP Senior fica
 * para depois].
 */
export class PlanoContasArquivoProvider implements PlanoContasProvider {
  constructor(private readonly caminhoArquivo: string = path.join(__dirname, 'plano-contas.txt')) {}

  async buscarContasAtivas(): Promise<ContaContabilPayload[]> {
    const conteudo = readFileSync(this.caminhoArquivo, 'utf-8');
    return parsePlanoContas(conteudo);
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
