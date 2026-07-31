import type { PrismaClient, TipoNivelUnidadeFuncional, UnidadeFuncional } from '@prisma/client';
import {
  CamposObrigatoriosPropostaError,
  PropostaImutavelError,
  PropostaNaoEncontradaError,
  VinculoHierarquicoInvalidoError,
} from '@/domain/plano-contas/errors';

type CriarUnidadeFuncionalInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  nome: string;
  tipoNivel: TipoNivelUnidadeFuncional;
  idPai?: string;
};

// US-106 — vínculo pai-filho rígido por tipo (RN_EST_02 + Cenário 3, [E1]).
// Níveis Sintéticos são sempre raiz (nunca têm pai) nesta árvore de 2 níveis.
const PAI_VALIDO: Record<TipoNivelUnidadeFuncional, TipoNivelUnidadeFuncional[]> = {
  SINTETICO_DIRETORIA: [],
  SINTETICO_GERENCIA: [],
  ANALITICO_ASSESSOR: ['SINTETICO_DIRETORIA'],
  ANALITICO_COORDENADORIA: ['SINTETICO_GERENCIA'],
  ANALITICO_SETOR: ['SINTETICO_GERENCIA'],
};

/** US-106 — Gerenciar Estrutura Funcional (Organograma) da Proposta. */
export class CriarUnidadeFuncionalUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CriarUnidadeFuncionalInput): Promise<UnidadeFuncional> {
    const nome = input.nome?.trim() ?? '';
    if (nome.length === 0) {
      throw new CamposObrigatoriosPropostaError();
    }

    const proposta = await this.prisma.proposta.findFirst({
      where: { tenantId: input.tenantId, id: input.propostaId },
    });
    if (!proposta) {
      throw new PropostaNaoEncontradaError();
    }
    if (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO') {
      throw new PropostaImutavelError();
    }

    const paisValidos = PAI_VALIDO[input.tipoNivel];
    const ehRaiz = paisValidos.length === 0;

    if (ehRaiz) {
      // Sintético é sempre raiz — idPai informado é ignorado silenciosamente.
      return this.criar(input, nome, null);
    }

    if (!input.idPai) {
      throw new VinculoHierarquicoInvalidoError();
    }
    const pai = await this.prisma.unidadeFuncional.findFirst({
      where: { tenantId: input.tenantId, propostaId: input.propostaId, id: input.idPai },
    });
    if (!pai || !paisValidos.includes(pai.tipoNivel)) {
      throw new VinculoHierarquicoInvalidoError();
    }

    return this.criar(input, nome, input.idPai);
  }

  private async criar(input: CriarUnidadeFuncionalInput, nome: string, idPai: string | null): Promise<UnidadeFuncional> {
    return this.prisma.$transaction(async (tx) => {
      const unidade = await tx.unidadeFuncional.create({
        data: {
          tenantId: input.tenantId,
          propostaId: input.propostaId,
          nome,
          tipoNivel: input.tipoNivel,
          idPai,
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'UNIDADE_FUNCIONAL_CRIADA',
          descricao: `Unidade Funcional "${nome}" (${input.tipoNivel}) criada`,
          dadosSerializados: { propostaId: input.propostaId, unidadeId: unidade.id, tipoNivel: input.tipoNivel, idPai },
        },
      });

      return unidade;
    });
  }
}
