import type { CategoriaProposta, PrismaClient, Proposta, TipoProposta, VersaoProposta } from '@prisma/client';
import {
  CamposObrigatoriosPropostaError,
  CodigoPropostaGeracaoFalhouError,
  DatasPropostaInvalidasError,
} from '@/domain/plano-contas/errors';
import { gerarProximoCodigoProposta, isUniqueConstraintError } from '@/domain/plano-contas/gerarCodigoProposta';

const MAX_TENTATIVAS_CODIGO = 5;

type CadastrarPropostaInput = {
  tenantId: string;
  usuarioId: string;
  tipo: TipoProposta;
  nome: string;
  dataInicio: Date;
  dataFim: Date;
  categoria: CategoriaProposta;
};

type CadastrarPropostaResult = Proposta & { versaoInicial: VersaoProposta };

/**
 * US-102 — Cadastrar Proposta. Cria a Proposta e sua Versão 1 (RASCUNHO,
 * vigente) na mesma transação (RN_PROP_002) — nenhuma Proposta existe sem
 * Versão, nenhuma Versão existe sem Proposta. Código gerado automaticamente
 * (PROP-{ano}-{sequencial}), com retry em caso de colisão de concorrência.
 */
export class CadastrarPropostaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CadastrarPropostaInput): Promise<CadastrarPropostaResult> {
    const nome = input.nome?.trim() ?? '';
    if (!input.tipo || nome.length === 0 || !input.dataInicio || !input.dataFim || !input.categoria) {
      throw new CamposObrigatoriosPropostaError();
    }
    // RN_PROP_004 — coerência cronológica.
    if (input.dataFim.getTime() <= input.dataInicio.getTime()) {
      throw new DatasPropostaInvalidasError();
    }

    const ano = new Date().getFullYear();

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS_CODIGO; tentativa++) {
      const codigo = await gerarProximoCodigoProposta(this.prisma, input.tenantId, ano);

      try {
        return await this.prisma.$transaction(async (tx) => {
          const proposta = await tx.proposta.create({
            data: {
              tenantId: input.tenantId,
              codigo,
              nome,
              tipo: input.tipo,
              categoria: input.categoria,
              dataInicio: input.dataInicio,
              dataFim: input.dataFim,
              status: 'RASCUNHO',
            },
          });

          const versaoInicial = await tx.versaoProposta.create({
            data: {
              tenantId: input.tenantId,
              propostaId: proposta.id,
              numeroVersao: 1,
              status: 'RASCUNHO',
              vigente: true,
              createdBy: input.usuarioId,
            },
          });

          await tx.historicoOperacao.create({
            data: {
              tenantId: input.tenantId,
              usuarioId: input.usuarioId,
              tipoOperacao: 'PROPOSTA_CRIADA',
              descricao: `Proposta "${codigo} — ${nome}" cadastrada`,
              dadosSerializados: { propostaId: proposta.id, versaoId: versaoInicial.id, codigo, tipo: input.tipo },
            },
          });

          return { ...proposta, versaoInicial };
        });
      } catch (erro) {
        if (isUniqueConstraintError(erro)) continue; // colisão de código — recalcula e tenta de novo
        throw erro;
      }
    }

    throw new CodigoPropostaGeracaoFalhouError();
  }
}
