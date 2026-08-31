import type { CargoMercadoProvider } from '@/infrastructure/integrations/cargo-mercado/types';

const LIMITE_RESULTADOS = 20;
const TAMANHO_MINIMO_TERMO = 2;

export type CandidatoCargoMercado = {
  codigoOrigem: string;
  nome: string;
};

/**
 * ADR-047 (US-139) — busca por substring (case-insensitive) no Catálogo de
 * Cargo de Mercado.
 *
 * Lê direto do provider (catálogo embutido em código, ~180 linhas), NÃO da
 * tabela `CargoMercadoCatalogo`: assim a importação funciona sempre, sem
 * depender de um sincronismo prévio nem de permissão — mesma experiência de
 * "só usar" da importação do Rubi. O sincronismo/tabela seguem existindo para
 * uma futura fonte HTTP real (basta trocar a implementação do provider), mas
 * não são mais pré-requisito da busca. Operação de leitura, não persiste nada.
 */
export class BuscarCargoMercadoCatalogoUseCase {
  constructor(private readonly provider: CargoMercadoProvider) {}

  async execute(termo: string): Promise<CandidatoCargoMercado[]> {
    const termoNormalizado = termo.trim();
    if (termoNormalizado.length < TAMANHO_MINIMO_TERMO) {
      return [];
    }

    const alvo = termoNormalizado.toLowerCase();
    const catalogo = await this.provider.buscarCatalogoAtivo();

    return catalogo
      .filter((linha) => linha.nome.toLowerCase().includes(alvo))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, LIMITE_RESULTADOS)
      .map((linha) => ({ codigoOrigem: linha.codigoOrigem, nome: linha.nome }));
  }
}
