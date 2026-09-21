import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import { montarAnexo6, type CargoParaAnexo6 } from '@/domain/anexo6/montarAnexo6';
import { serializarAnexo6, type Anexo6Serializado } from './anexo6Tipos';
import { RelatorioAnexo6Panel } from './RelatorioAnexo6Panel';

const CHAVE_FUNCIONALIDADE = 'orcamentario.anexo6-custo-empregados.visualizar';

/**
 * ANEXO 6 — COMPOSIÇÃO DOS CUSTOS DE REMUNERAÇÃO E BENEFÍCIOS (EMPREGADOS).
 *
 * Relatório formal por Proposta, no layout da IN 05/2017: uma coluna por Cargo
 * e as linhas agrupadas em Módulos 1 a 6. Recorte (decisão do usuário
 * 2026-09-21): Proposta + versão vigente, sem filtro por Meta, Unidade
 * Funcional ou período. Cargo sem empregado vinculado entra na planilha do
 * mesmo jeito, com headcount zero.
 */
export default async function Anexo6CustoEmpregadosPage({
  searchParams,
}: {
  searchParams: Promise<{ propostaId?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) redirect('/login');

  const podeVisualizar = await usuarioTemFuncionalidade(prisma, tenantId, usuario.id, CHAVE_FUNCIONALIDADE);
  if (!podeVisualizar) {
    return <p className="p-6 text-sm text-gray-500">Sem permissão para visualizar o ANEXO 6 — Composição de Custo de Empregados.</p>;
  }

  const { propostaId } = await searchParams;

  const propostasDisponiveis = await prisma.proposta.findMany({
    where: { tenantId },
    orderBy: { codigo: 'desc' },
    select: { id: true, codigo: true, nome: true },
  });

  let propostaSelecionada: { id: string; codigo: string; nome: string } | null = null;
  let anexo: Anexo6Serializado | null = null;
  let semCargos = false;

  if (propostaId) {
    const proposta = await prisma.proposta.findFirst({
      where: { tenantId, id: propostaId },
      select: { id: true, codigo: true, nome: true },
    });

    if (proposta) {
      propostaSelecionada = proposta;

      const [cargos, contagemEmpregados, parametros] = await Promise.all([
        prisma.cargo.findMany({
          where: { tenantId, propostaId: proposta.id, ativo: true },
          orderBy: { nomeCargoMercado: 'asc' },
          select: {
            id: true,
            nomeCargoMercado: true,
            salarioTotal: true,
            funcaoGratificada: true,
            encargosSociaisPct: true,
            vaAtivo: true,
            vaValorUnitario: true,
            vrAtivo: true,
            vrValorUnitario: true,
            planoSaudeAtivo: true,
            planoSaudeFaixa: true,
            planoSaudeValor: true,
            planoOdontoAtivo: true,
            planoOdontoValor: true,
            seguroVidaAtivo: true,
            seguroVidaValor: true,
            auxilioCrecheAtivo: true,
            auxilioCrecheValor: true,
            transporteAtivo: true,
            transporteValorUnitario: true,
            periculosidadeAtivo: true,
            periculosidadeTipo: true,
            periculosidadeValor: true,
            insalubridadeAtivo: true,
            insalubridadeTipo: true,
            insalubridadeValor: true,
          },
        }),
        prisma.empregadoHeadcount.groupBy({
          by: ['cargoId'],
          where: { tenantId, propostaId: proposta.id, ativo: true },
          _count: { _all: true },
        }),
        prisma.parametroSistema.findUnique({ where: { tenantId }, select: { diasUteisPadrao: true } }),
      ]);

      semCargos = cargos.length === 0;

      if (!semCargos) {
        const empregadosPorCargo = new Map(contagemEmpregados.map((linha) => [linha.cargoId, linha._count._all]));
        const cargosParaAnexo: CargoParaAnexo6[] = cargos.map((cargo) => ({
          ...cargo,
          quantidadeEmpregados: empregadosPorCargo.get(cargo.id) ?? 0,
        }));

        anexo = serializarAnexo6(montarAnexo6(cargosParaAnexo, parametros?.diasUteisPadrao ?? 22));
      }
    }
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[#F7F8FA] p-6 dark:bg-[#12151C]">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">
          ANEXO 6 — Composição de Custo de Empregados
        </h1>
        <Link
          href="/orcamentario"
          className="rounded-lg border border-[#DDE2EA] bg-white px-4 py-2 text-sm font-medium text-[#2B5FD9] shadow-sm hover:shadow-md dark:border-[#2B303C] dark:bg-[#191D26] dark:text-[#6D93F0]"
        >
          &larr; Módulo Orçamentário
        </Link>
      </header>

      <form className="flex flex-wrap items-end gap-3 rounded-[10px] border border-[#DDE2EA] bg-white p-4 shadow-sm dark:border-[#2B303C] dark:bg-[#191D26] print:hidden">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="propostaId"
            className={`text-xs font-medium ${!propostaId ? 'text-[#C43D3D] dark:text-[#E0716B]' : 'text-[#5B6270] dark:text-[#A4AAB6]'}`}
          >
            Termo de Parceria / Proposta *
          </label>
          <select
            id="propostaId"
            name="propostaId"
            defaultValue={propostaId ?? ''}
            className={`rounded-lg border bg-white px-3 py-2 text-sm dark:bg-[#12151C] dark:text-[#EBEDF2] ${
              !propostaId ? 'border-[#C43D3D] dark:border-[#E0716B]' : 'border-[#DDE2EA] dark:border-[#2B303C]'
            }`}
          >
            <option value="">Selecione...</option>
            {propostasDisponiveis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nome}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-[7px] bg-[#2B5FD9] px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-110 dark:bg-[#6D93F0] dark:text-[#12151C]"
        >
          Pesquisar
        </button>
      </form>

      {!propostaId && (
        <p className="text-sm text-[#C43D3D] dark:text-[#E0716B]">
          Operação Rejeitada: a seleção de uma Proposta é obrigatória para a abertura do ANEXO 6.
        </p>
      )}

      {propostaId && !propostaSelecionada && <p className="text-sm text-[#C43D3D] dark:text-[#E0716B]">Proposta não encontrada.</p>}

      {propostaSelecionada && semCargos && (
        <p className="text-sm text-[#C43D3D] dark:text-[#E0716B]">
          Operação Rejeitada: a Proposta selecionada não possui Cargos cadastrados — sem Cargo não há coluna para compor o ANEXO 6.
        </p>
      )}

      {propostaSelecionada && anexo && (
        <RelatorioAnexo6Panel codigoProposta={propostaSelecionada.codigo} nomeProposta={propostaSelecionada.nome} anexo={anexo} />
      )}
    </main>
  );
}
