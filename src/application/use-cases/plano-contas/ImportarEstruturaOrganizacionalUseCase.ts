import type { PrismaClient } from '@prisma/client';
import {
  EstruturaOrigemVaziaError,
  ImportacaoEstruturaBloqueadaPorCargoVinculadoError,
  PropostaImutavelError,
  PropostaNaoEncontradaError,
} from '@/domain/plano-contas/errors';

type ImportarEstruturaOrganizacionalInput = {
  tenantId: string;
  usuarioId: string;
  propostaOrigemId: string;
  propostaDestinoId: string;
};

type ImportarEstruturaOrganizacionalResult = {
  unidadesInativadas: number;
  unidadesCriadas: number;
};

/**
 * US-130 (ADR-041) — Importar Estrutura Organizacional de uma Proposta para
 * outra já existente. Cópia congelada (registros novos, independentes da
 * origem — editar a origem depois não propaga), substitui qualquer
 * organograma já existente na destino (inativa e recria), sem restrição por
 * `tipo` de Proposta.
 *
 * Remapeamento de hierarquia em 2 passos (não há grafo genérico a resolver —
 * ADR-015 fixa a árvore em 2 níveis): Sintéticas primeiro, guardando
 * Map<idOrigem, idNovo>; Analíticas depois, resolvendo `idPai` pelo map.
 */
export class ImportarEstruturaOrganizacionalUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ImportarEstruturaOrganizacionalInput): Promise<ImportarEstruturaOrganizacionalResult> {
    const [origem, destino] = await Promise.all([
      this.prisma.proposta.findFirst({ where: { tenantId: input.tenantId, id: input.propostaOrigemId } }),
      this.prisma.proposta.findFirst({ where: { tenantId: input.tenantId, id: input.propostaDestinoId } }),
    ]);
    if (!origem) throw new PropostaNaoEncontradaError();
    if (!destino) throw new PropostaNaoEncontradaError();
    if (destino.status !== 'RASCUNHO' && destino.status !== 'EM_ELABORACAO') {
      throw new PropostaImutavelError();
    }

    const unidadesOrigem = await this.prisma.unidadeFuncional.findMany({
      where: { tenantId: input.tenantId, propostaId: origem.id, ativa: true },
      orderBy: { createdAt: 'asc' },
    });
    if (unidadesOrigem.length === 0) {
      throw new EstruturaOrigemVaziaError();
    }

    // Cenário 4 [TRAVA O ERRO] — checagem em lote, read-only, antes de qualquer escrita.
    const unidadesDestinoComCargo = await this.prisma.unidadeFuncional.findMany({
      where: {
        tenantId: input.tenantId,
        propostaId: destino.id,
        ativa: true,
        cargos: { some: { ativo: true } },
      },
      select: { id: true, nome: true },
    });
    if (unidadesDestinoComCargo.length > 0) {
      throw new ImportacaoEstruturaBloqueadaPorCargoVinculadoError(unidadesDestinoComCargo.map((u) => u.nome));
    }

    const sinteticas = unidadesOrigem.filter((u) => u.idPai === null);
    const analiticas = unidadesOrigem.filter((u) => u.idPai !== null);

    const resultado = await this.prisma.$transaction(async (tx) => {
      const unidadesDestinoAtuais = await tx.unidadeFuncional.findMany({
        where: { tenantId: input.tenantId, propostaId: destino.id, ativa: true },
        select: { id: true },
      });
      if (unidadesDestinoAtuais.length > 0) {
        await tx.unidadeFuncional.updateMany({
          where: { id: { in: unidadesDestinoAtuais.map((u) => u.id) } },
          data: { ativa: false },
        });
      }

      const criarUnidade = (nome: string, tipoNivel: (typeof sinteticas)[number]['tipoNivel'], idPai: string | null) =>
        tx.unidadeFuncional.create({
          data: { tenantId: input.tenantId, propostaId: input.propostaDestinoId, nome, tipoNivel, idPai },
        });

      const mapIdAntigoParaNovo = new Map<string, string>();

      for (const unidade of sinteticas) {
        const nova = await criarUnidade(unidade.nome, unidade.tipoNivel, null);
        mapIdAntigoParaNovo.set(unidade.id, nova.id);
      }
      for (const unidade of analiticas) {
        const idPaiNovo = mapIdAntigoParaNovo.get(unidade.idPai!) ?? null;
        const nova = await criarUnidade(unidade.nome, unidade.tipoNivel, idPaiNovo);
        mapIdAntigoParaNovo.set(unidade.id, nova.id);
      }

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'ESTRUTURA_ORGANIZACIONAL_IMPORTADA',
          descricao: `Estrutura Organizacional importada da Proposta "${origem.nome}" para "${destino.nome}"`,
          dadosSerializados: {
            propostaOrigemId: origem.id,
            propostaDestinoId: destino.id,
            unidadesInativadas: unidadesDestinoAtuais.length,
            unidadesCriadas: unidadesOrigem.length,
          },
        },
      });

      return { unidadesInativadas: unidadesDestinoAtuais.length, unidadesCriadas: unidadesOrigem.length };
    });

    return resultado;
  }
}
