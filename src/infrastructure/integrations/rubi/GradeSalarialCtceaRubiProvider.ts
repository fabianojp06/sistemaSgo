import { Prisma, type PrismaClient } from '@prisma/client';
import type { BuscarCandidatosCargoRubiInput, CandidatoCargoRubi, CargoRubiProvider } from './types';

/**
 * ADR-046 (US-137) — substitui CargoRubiFixtureProvider (gerador por hash).
 * Consulta GradeSalarialCtcea via Prisma: mesmo status que
 * PlanoContasArquivoProvider tem hoje em relação a ContaContabil — dado real
 * sincronizado, não mais gerado na hora da busca.
 *
 * Mapeamento dos 5 campos [ORIGEM BLINDADA] de CandidatoCargoRubi (definidos na
 * ADR-045/US-132, que não muda) para o novo modelo, que não tem mais uma
 * "Tabela Salarial" separada:
 * - nomeCargoMercado  ← cargoMercado (ou placeholder até a 2ª fonte chegar)
 * - faixaCodigo/Descricao ← faixa (F1-F7)
 * - nivelCodigo/Descricao ← nivel (N1-N20)
 * - tabSalCodigo/Descricao ← reaproveitado para expor `cargoCtcea` (o
 *   identificador da fonte/classificação de origem, ver US-137) quando já
 *   preenchido; cai para a própria Faixa como identificador enquanto
 *   `cargoCtcea` ainda for null — mantém os 5 campos sempre preenchidos sem
 *   inventar uma "Tabela Salarial" que não existe mais neste desenho.
 * - salarioReal ← salario
 */
export class GradeSalarialCtceaRubiProvider implements CargoRubiProvider {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarCandidatos(input: BuscarCandidatosCargoRubiInput): Promise<CandidatoCargoRubi[]> {
    const { tenantId, faixa, nivel, termo } = input;

    const termoNormalizado = termo?.trim();

    const linhas = await this.prisma.gradeSalarialCtcea.findMany({
      where: {
        tenantId,
        ...(faixa ? { faixa } : {}),
        ...(nivel ? { nivel } : {}),
        ...(termoNormalizado
          ? {
              OR: [
                { cargoMercado: { contains: termoNormalizado, mode: 'insensitive' } },
                { cargoCtcea: { contains: termoNormalizado, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ faixa: 'asc' }, { nivel: 'asc' }],
    });

    return linhas.map((linha) => {
      const tabSalCodigo = linha.cargoCtcea ?? linha.faixa;
      const tabSalDescricao = linha.cargoCtcea ? `Cargo CTCEA: ${linha.cargoCtcea}` : `Grade CTCEA — Faixa ${linha.faixa}`;

      return {
        nomeCargoMercado: linha.cargoMercado ?? '(sem nome cadastrado)',
        tabSalCodigo,
        tabSalDescricao,
        faixaCodigo: linha.faixa,
        faixaDescricao: `Faixa ${linha.faixa}`,
        nivelCodigo: linha.nivel,
        nivelDescricao: `Nível ${linha.nivel}`,
        salarioReal: new Prisma.Decimal(linha.salario.toString()),
      };
    });
  }
}
