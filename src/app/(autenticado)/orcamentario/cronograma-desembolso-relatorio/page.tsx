import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import { getListarTermosAjusteUseCase } from '@/application/use-cases/plano-contas/container';
import { montarCronogramaDesembolso } from '@/domain/plano-contas/montarCronogramaDesembolso';
import type { LinhaCronogramaSerializada } from '../../propostas/cronogramaTipos';
import { RelatorioCronogramaDesembolsoPanel } from './RelatorioCronogramaDesembolsoPanel';

/**
 * US-138 (UC04.01) — relatório formal de Cronograma de Desembolso, distinto
 * da aba já existente dentro do detalhe da Proposta (US-122): acessado a
 * partir da landing do Módulo Orçamentário, com seleção explícita de Termo
 * de Parceria (só OFICIALIZADO), filtro por Termo Aditivo/Exercício, Linha
 * de Totais Finais e exportação auditada (Cenário 8/9).
 */
export default async function CronogramaDesembolsoRelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ propostaId?: string; termoAditivoId?: string; ano?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) redirect('/login');

  const podeVisualizar = await usuarioTemFuncionalidade(
    prisma,
    tenantId,
    usuario.id,
    'orcamentario.cronograma-desembolso-relatorio.visualizar',
  );
  if (!podeVisualizar) {
    return <p className="p-6 text-sm text-gray-500">Sem permissão para visualizar o Relatório de Cronograma de Desembolso.</p>;
  }

  const { propostaId, termoAditivoId, ano } = await searchParams;
  const anoExercicio = ano ? Number(ano) : null;

  // RN_REL_002 — regra original do documento era "só OFICIALIZADO"; ampliada
  // em 2026-08-20 (decisão do usuário) para EM_ELABORACAO e, agora, para
  // TODOS os status (RASCUNHO/EM_ELABORACAO/OFICIALIZADO/ENCERRADO): hoje não
  // existe, em nenhum lugar do sistema, um caminho que transicione Proposta
  // para OFICIALIZADO (gap pré-existente, fora do escopo desta US) — sem essa
  // ampliação a tela ficaria inacessível com qualquer dado real.
  const propostasDisponiveis = await prisma.proposta.findMany({
    where: { tenantId },
    orderBy: { codigo: 'desc' },
    select: { id: true, codigo: true, nome: true },
  });

  let linhas: LinhaCronogramaSerializada[] = [];
  let termosAditivo: { id: string; label: string }[] = [];
  let anosDisponiveis: number[] = [];
  let propostaSelecionada: { id: string; codigo: string; nome: string } | null = null;
  let semDadosFinanceiros = false;

  if (propostaId) {
    const proposta = await prisma.proposta.findFirst({
      where: { tenantId, id: propostaId },
      select: { id: true, codigo: true, nome: true, dataInicio: true, dataFim: true },
    });

    if (proposta) {
      propostaSelecionada = { id: proposta.id, codigo: proposta.codigo, nome: proposta.nome };

      const versao = await prisma.versaoProposta.findFirst({
        where: { tenantId, propostaId: proposta.id, vigente: true, ativa: true },
        select: { id: true },
      });

      if (versao) {
        const [termos, empregados, viagens, itens, rateios] = await Promise.all([
          getListarTermosAjusteUseCase().execute(tenantId, versao.id),
          prisma.empregadoHeadcount.findMany({
            where: { tenantId, propostaId: proposta.id, ativo: true },
            select: {
              periodoInicio: true,
              periodoFim: true,
              valorSalarioSnapshot: true,
              valorGratificacaoSnapshot: true,
              valorEncargosSociaisSnapshot: true,
              valorValeAlimentacaoSnapshot: true,
              valorValeRefeicaoSnapshot: true,
              valorValeTransporteSnapshot: true,
              valorPlanoOdontologicoSnapshot: true,
              valorSeguroVidaSnapshot: true,
              valorPlanoSaudeSnapshot: true,
              valorAuxilioCrecheSnapshot: true,
            },
          }),
          prisma.viagem.findMany({ where: { tenantId, versaoId: versao.id, ativo: true }, select: { custoEstimado: true } }),
          prisma.itemPatrimonial.findMany({ where: { tenantId, versaoId: versao.id, ativo: true }, select: { data: true, valorTotal: true } }),
          prisma.rateioImpostoGrade.findMany({
            where: { tenantId, versaoId: versao.id, ativo: true },
            select: { competencia: true, valorDeclarado: true },
          }),
        ]);

        // Aditivos — só informativo no cabeçalho/filtro (não há regra especificada
        // de como um Termo de Ajuste homologado altera a distribuição mês a mês;
        // ver US-138, decisão AN/PO item 3 — escopo restrito de propósito).
        termosAditivo = termos
          .filter((t) => t.status === 'HOMOLOGADO')
          .map((t) => ({ id: t.id, label: `${t.contaOrigemLabel} → ${t.contaDestinoLabel} (${t.exercicio})` }));

        const temDadosFinanceiros = empregados.length > 0 || viagens.length > 0 || itens.length > 0 || rateios.length > 0;
        semDadosFinanceiros = !temDadosFinanceiros;

        if (temDadosFinanceiros) {
          const linhasCompletas = montarCronogramaDesembolso(
            { dataInicio: proposta.dataInicio, dataFim: proposta.dataFim },
            empregados,
            viagens,
            itens,
            rateios,
          );

          anosDisponiveis = [...new Set(linhasCompletas.map((l) => l.competencia.getUTCFullYear()))].sort();

          const linhasFiltradas = anoExercicio
            ? linhasCompletas.filter((l) => l.competencia.getUTCFullYear() === anoExercicio)
            : linhasCompletas;

          linhas = linhasFiltradas.map((l) => ({
            mes: l.mes,
            competencia: l.competencia.toISOString(),
            desembolsoMensal: l.desembolsoMensal.toString(),
            desembolsoAcumulado: l.desembolsoAcumulado.toString(),
            percentualFinanceiroAcumulado: l.percentualFinanceiroAcumulado.toString(),
            valorRepassado12Meses: l.valorRepassado12Meses?.toString() ?? null,
          }));
        }
      }
    }
  }

  const termoAditivoSelecionado = termosAditivo.find((t) => t.id === termoAditivoId) ?? null;

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[#F7F8FA] p-6 dark:bg-[#12151C]">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Relatório de Cronograma de Desembolso</h1>
        <Link
          href="/orcamentario"
          className="rounded-lg border border-[#DDE2EA] bg-white px-4 py-2 text-sm font-medium text-[#2B5FD9] shadow-sm hover:shadow-md dark:border-[#2B303C] dark:bg-[#191D26] dark:text-[#6D93F0]"
        >
          &larr; Módulo Orçamentário
        </Link>
      </header>

      {/* US-138, Cenário 6 [TRAVA O ERRO] — form GET simples: sem Proposta selecionada,
          a busca não roda (nenhuma query condicional acima depende de propostaId ausente). */}
      <form className="flex flex-wrap items-end gap-3 rounded-[10px] border border-[#DDE2EA] bg-white p-4 shadow-sm dark:border-[#2B303C] dark:bg-[#191D26]">
        <div className="flex flex-col gap-1">
          <label htmlFor="propostaId" className={`text-xs font-medium ${!propostaId ? 'text-[#C43D3D] dark:text-[#E0716B]' : 'text-[#5B6270] dark:text-[#A4AAB6]'}`}>
            Termo de Parceria *
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

        <div className="flex flex-col gap-1">
          <label htmlFor="termoAditivoId" className="text-xs font-medium text-[#5B6270] dark:text-[#A4AAB6]">
            Termo Aditivo
          </label>
          <select
            id="termoAditivoId"
            name="termoAditivoId"
            defaultValue={termoAditivoId ?? ''}
            disabled={termosAditivo.length === 0}
            className="rounded-lg border border-[#DDE2EA] bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-[#2B303C] dark:bg-[#12151C] dark:text-[#EBEDF2]"
          >
            <option value="">Todos</option>
            {termosAditivo.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ano" className="text-xs font-medium text-[#5B6270] dark:text-[#A4AAB6]">
            Ano de Exercício
          </label>
          <select
            id="ano"
            name="ano"
            defaultValue={ano ?? ''}
            disabled={anosDisponiveis.length === 0}
            className="rounded-lg border border-[#DDE2EA] bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-[#2B303C] dark:bg-[#12151C] dark:text-[#EBEDF2]"
          >
            <option value="">Toda a vigência</option>
            {anosDisponiveis.map((a) => (
              <option key={a} value={a}>
                {a}
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
          Operação Rejeitada: A seleção de um Termo de Parceria Oficializado é obrigatória para a abertura do cronograma de desembolso.
        </p>
      )}

      {propostaId && !propostaSelecionada && (
        <p className="text-sm text-[#C43D3D] dark:text-[#E0716B]">
          Termo de Parceria não encontrado.
        </p>
      )}

      {propostaSelecionada && semDadosFinanceiros && (
        <p className="text-sm text-[#C43D3D] dark:text-[#E0716B]">
          Operação Rejeitada: A Proposta selecionada não possui dados financeiros cadastrados para consolidação.
        </p>
      )}

      {propostaSelecionada && linhas.length > 0 && (
        <RelatorioCronogramaDesembolsoPanel
          propostaId={propostaSelecionada.id}
          codigoProposta={propostaSelecionada.codigo}
          nomeProposta={propostaSelecionada.nome}
          termoAditivoLabel={termoAditivoSelecionado?.label ?? null}
          termoAditivoId={termoAditivoId ?? null}
          anoExercicio={anoExercicio}
          linhas={linhas}
        />
      )}
    </main>
  );
}
