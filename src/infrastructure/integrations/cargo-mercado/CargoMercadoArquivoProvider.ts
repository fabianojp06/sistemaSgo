import type { CargoMercadoPayload, CargoMercadoProvider } from './types';
import { CARGO_MERCADO_RAW } from './cargo-mercado-raw';

/**
 * Fonte do Catálogo de Cargo de Mercado, embutida como constante em
 * cargo-mercado-raw.ts — mesmo padrão de GradeSalarialCtceaArquivoProvider
 * (ADR-047/US-139). Interface pensada para ser trocada, no futuro, por um
 * provider HTTP real do ERP de RH, sem mudar use case nem UI.
 */
export class CargoMercadoArquivoProvider implements CargoMercadoProvider {
  async buscarCatalogoAtivo(): Promise<CargoMercadoPayload[]> {
    return CARGO_MERCADO_RAW.map((linha) => ({
      codigoOrigem: linha.codigoOrigem,
      nome: linha.nome,
    }));
  }
}
