import type { Cargo, FonteAtivaSalario, PrismaClient } from '@prisma/client';
import {
  CamposObrigatoriosCargoError,
  CodigoCargoGeracaoFalhouError,
  UnidadeFuncionalNaoEncontradaError,
  VinculoCargoNaoAnaliticoError,
  VinculoFuncionalObrigatorioError,
} from '@/domain/plano-contas/errors';
import { gerarProximoCodigoCargo } from '@/domain/plano-contas/gerarCodigoCargo';
import { isUniqueConstraintError } from '@/domain/plano-contas/gerarCodigoProposta';
import { calcularSalarioTotalCargo } from '@/domain/plano-contas/calcularSalarioTotalCargo';
import type { CargoRubiProvider } from '@/infrastructure/integrations/rubi/types';

const MAX_TENTATIVAS_CODIGO = 5;

// US-107, RN_CAR_01 — só nós Analíticos aceitam vínculo de Cargo; Sintéticos
// (Diretoria/Gerência) existem apenas para consolidar.
const TIPOS_ANALITICOS = ['ANALITICO_ASSESSOR', 'ANALITICO_COORDENADORIA', 'ANALITICO_SETOR'];

type CadastrarCargoInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  unidadeFuncionalId: string;
  nomeCargoMercado: string;
  funcaoGratificada?: number | null;
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

    // Cenário 2 [TRAVA O ERRO] — vínculo funcional é obrigatório.
    if (!input.unidadeFuncionalId) {
      throw new VinculoFuncionalObrigatorioError();
    }

    const unidade = await this.prisma.unidadeFuncional.findFirst({
      where: { tenantId: input.tenantId, id: input.unidadeFuncionalId, propostaId: input.propostaId },
    });
    if (!unidade) {
      throw new UnidadeFuncionalNaoEncontradaError();
    }
    // Cenário 3 [TRAVA O ERRO] — só nó Analítico aceita vínculo de Cargo.
    if (!TIPOS_ANALITICOS.includes(unidade.tipoNivel)) {
      throw new VinculoCargoNaoAnaliticoError();
    }

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
              unidadeFuncionalId: input.unidadeFuncionalId,
              nomeCargoMercado: nome,
              codigoCargo,
              funcaoGratificada: input.funcaoGratificada ?? null,
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

          await tx.historicoOperacao.create({
            data: {
              tenantId: input.tenantId,
              usuarioId: input.usuarioId,
              tipoOperacao: 'CARGO_CRIADO',
              descricao: `Cargo "${codigoCargo} — ${nome}" cadastrado`,
              dadosSerializados: {
                cargoId: cargo.id,
                propostaId: input.propostaId,
                unidadeFuncionalId: input.unidadeFuncionalId,
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
