import type { Cargo, FonteAtivaSalario, PrismaClient } from '@prisma/client';
import {
  CamposObrigatoriosCargoError,
  CodigoCargoGeracaoFalhouError,
  ContaCargoNaoAnaliticaError,
  SomaAlocacaoCargoInvalidaError,
  UnidadeFuncionalNaoEncontradaError,
  VinculoCargoNaoAnaliticoError,
  VinculoFuncionalObrigatorioError,
} from '@/domain/plano-contas/errors';
import { gerarProximoCodigoCargo } from '@/domain/plano-contas/gerarCodigoCargo';
import { isUniqueConstraintError } from '@/domain/plano-contas/gerarCodigoProposta';
import { calcularSalarioTotalCargo } from '@/domain/plano-contas/calcularSalarioTotalCargo';
import { validarContasComponenteCusto } from '@/domain/plano-contas/validarContasComponenteCusto';
import type { CargoRubiProvider } from '@/infrastructure/integrations/rubi/types';

const MAX_TENTATIVAS_CODIGO = 5;

// US-107, RN_CAR_01 — só nós Analíticos aceitam vínculo de Cargo; Sintéticos
// (Diretoria/Gerência) existem apenas para consolidar.
const TIPOS_ANALITICOS = ['ANALITICO_ASSESSOR', 'ANALITICO_COORDENADORIA', 'ANALITICO_SETOR'];

type AlocacaoInput = { unidadeFuncionalId: string; percentual: number };

type CadastrarCargoInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  /** ADR-026, RN_EST_03 — rateio percentual entre unidades funcionais analíticas, soma sempre 100. */
  alocacoes: AlocacaoInput[];
  /** ADR-027 — natureza da despesa (ex: "Despesa com Pessoal"); 1 conta analítica fixa por Cargo. */
  contaId: string;
  nomeCargoMercado: string;
  funcaoGratificada?: number | null;
  /** ADR-029 — conta analítica da Função Gratificada; null se o campo não estiver preenchido. */
  contaGratificacaoId?: string | null;
  periodoInicio: Date;
  salarioMercadoMinimo: number;
  salarioMercadoMaximo: number;
  fonteAtiva: FonteAtivaSalario;
};

/**
 * US-107 — Cadastrar Cargo e Parametrizar Fonte Salarial. Cobre os blocos A
 * (Identificação e Vínculo Funcional) e B (Painel de Fontes Salariais) do
 * UC03.19; Benefícios/Encargos (bloco C) fica para US-107a.
 */
export class CadastrarCargoUseCase {
  constructor(private readonly prisma: PrismaClient, private readonly rubiProvider: CargoRubiProvider) {}

  async execute(input: CadastrarCargoInput): Promise<Cargo> {
    const nome = input.nomeCargoMercado?.trim() ?? '';
    if (
      nome.length === 0 ||
      !input.periodoInicio ||
      input.salarioMercadoMinimo === undefined ||
      input.salarioMercadoMaximo === undefined ||
      !input.fonteAtiva
    ) {
      throw new CamposObrigatoriosCargoError();
    }

    // Cenário 2 [TRAVA O ERRO] — vínculo funcional é obrigatório (RN_EST_01).
    if (!input.alocacoes || input.alocacoes.length === 0) {
      throw new VinculoFuncionalObrigatorioError();
    }

    // RN_EST_03 [TRAVA O ERRO] — soma das alocações deve ser exatamente 100%.
    const somaPercentual = input.alocacoes.reduce((soma, a) => soma + a.percentual, 0);
    if (Math.abs(somaPercentual - 100) > 0.01) {
      throw new SomaAlocacaoCargoInvalidaError();
    }

    const unidades = await this.prisma.unidadeFuncional.findMany({
      where: { tenantId: input.tenantId, id: { in: input.alocacoes.map((a) => a.unidadeFuncionalId) }, propostaId: input.propostaId },
    });
    const unidadesPorId = new Map(unidades.map((u) => [u.id, u]));
    for (const alocacao of input.alocacoes) {
      const unidade = unidadesPorId.get(alocacao.unidadeFuncionalId);
      if (!unidade) {
        throw new UnidadeFuncionalNaoEncontradaError();
      }
      // Cenário 3 [TRAVA O ERRO] — só nó Analítico aceita vínculo de Cargo (RN_EST_02), linha a linha.
      if (!TIPOS_ANALITICOS.includes(unidade.tipoNivel)) {
        throw new VinculoCargoNaoAnaliticoError();
      }
    }

    // ADR-027 [TRAVA O ERRO] — conta precisa existir, pertencer ao tenant e ser analítica.
    const conta = await this.prisma.contaContabil.findFirst({
      where: { tenantId: input.tenantId, id: input.contaId },
      select: { isAnalitica: true },
    });
    if (!conta?.isAnalitica) {
      throw new ContaCargoNaoAnaliticaError();
    }

    // ADR-029 [TRAVA O ERRO] — conta da Função Gratificada, se informada, precisa ser analítica.
    await validarContasComponenteCusto(this.prisma, input.tenantId, {
      gratificacao: { id: input.contaGratificacaoId ?? null, label: 'Função Gratificada' },
    });

    // RN_CAR_03 — Salário Real vem exclusivamente do provider Rubi (fixture por ora).
    const salarioReal = await this.rubiProvider.buscarSalarioReal(nome);

    const salarioTotal = calcularSalarioTotalCargo({
      fonteAtiva: input.fonteAtiva,
      salarioMercadoMinimo: input.salarioMercadoMinimo,
      salarioMercadoMaximo: input.salarioMercadoMaximo,
      salarioReal,
      funcaoGratificada: input.funcaoGratificada ?? null,
    });

    const ano = new Date().getFullYear();

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS_CODIGO; tentativa++) {
      const codigoCargo = await gerarProximoCodigoCargo(this.prisma, input.tenantId, ano);

      try {
        return await this.prisma.$transaction(async (tx) => {
          const cargo = await tx.cargo.create({
            data: {
              tenantId: input.tenantId,
              propostaId: input.propostaId,
              contaId: input.contaId,
              nomeCargoMercado: nome,
              codigoCargo,
              funcaoGratificada: input.funcaoGratificada ?? null,
              contaGratificacaoId: input.contaGratificacaoId ?? null,
              periodoInicio: input.periodoInicio,
              salarioMercadoMinimo: input.salarioMercadoMinimo,
              salarioMercadoMaximo: input.salarioMercadoMaximo,
              fonteAtiva: input.fonteAtiva,
              salarioReal,
              statusSyncSalario: salarioReal ? 'SINCRONIZADO' : 'PENDENTE',
              syncedAt: salarioReal ? new Date() : null,
              salarioTotal,
            },
          });

          await tx.cargoAlocacaoPercentual.createMany({
            data: input.alocacoes.map((a) => ({
              tenantId: input.tenantId,
              cargoId: cargo.id,
              unidadeFuncionalId: a.unidadeFuncionalId,
              percentual: a.percentual,
            })),
          });

          await tx.historicoOperacao.create({
            data: {
              tenantId: input.tenantId,
              usuarioId: input.usuarioId,
              tipoOperacao: 'CARGO_CRIADO',
              descricao: `Cargo "${codigoCargo} — ${nome}" cadastrado`,
              dadosSerializados: {
                cargoId: cargo.id,
                propostaId: input.propostaId,
                alocacoes: input.alocacoes,
                fonteAtiva: input.fonteAtiva,
                salarioTotal: salarioTotal.toString(),
              },
            },
          });

          return cargo;
        });
      } catch (erro) {
        if (isUniqueConstraintError(erro)) continue; // colisão de código — recalcula e tenta de novo
        throw erro;
      }
    }

    throw new CodigoCargoGeracaoFalhouError();
  }
}
