import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { podeEditarVersao } from '@/domain/plano-contas/podeEditarVersao';
import { ValorOrcadoContaForm } from '@/app/plano-contas/ValorOrcadoContaForm';
import { BadgeSemaforoPanel } from '@/app/plano-contas/BadgeSemaforoPanel';
import { ValorOrcadoResumoPanel } from '@/app/plano-contas/ValorOrcadoResumoPanel';
import { RateioImpostoPanel } from '@/app/plano-contas/RateioImpostoPanel';
import { TermoAjustePanel } from '@/app/plano-contas/TermoAjustePanel';
import { getListarTermosAjusteUseCase } from '@/application/use-cases/plano-contas/container';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import { PropostaTabs } from '../../PropostaTabs';
import { MetaPanel } from '../../MetaPanel';
import { EmpregadoPanel } from '../../EmpregadoPanel';
import { ViagemPanel } from '../../ViagemPanel';
import { ItemPatrimonialPanel } from '../../ItemPatrimonialPanel';
import { CronogramaDesembolsoPanel } from '../../CronogramaDesembolsoPanel';
import { montarCronogramaDesembolso } from '@/domain/plano-contas/montarCronogramaDesembolso';

const GUIAS = [
  { slug: 'valor-orcado', label: 'Valor Orçado' },
  { slug: 'lancar-valor-orcado', label: 'Lançar Valor Orçado' },
  { slug: 'semaforo', label: 'Semáforo' },
  { slug: 'meta', label: 'Meta' },
  { slug: 'empregados', label: 'Empregados' },
  { slug: 'viagens', label: 'Viagens' },
  { slug: 'bens', label: 'Bens/Serviços/Equipamentos' },
  { slug: 'rateio-impostos', label: 'Rateio de Impostos' },
  { slug: 'termo-ajuste', label: 'Termo de Ajuste' },
  { slug: 'cronograma-desembolso', label: 'Cronograma de Desembolso' },
] as const;

/** US-115 (UC03.06) — capa Read-only + guias analíticas por Versão de Proposta. */
export default async function PropostaDetalhePage({
  params,
}: {
  params: Promise<{ id: string; guia?: string[] }>;
}) {
  const { id, guia } = await params;
  const guiaAtiva = guia?.[0] ?? GUIAS[0].slug;
  if (!GUIAS.some((g) => g.slug === guiaAtiva)) notFound();

  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) redirect('/login');

  const proposta = await prisma.proposta.findFirst({ where: { tenantId, id } });
  if (!proposta) notFound();

  const versao = await prisma.versaoProposta.findFirst({
    where: { tenantId, propostaId: id, vigente: true, ativa: true },
  });
  if (!versao) notFound();

  const readOnly = !podeEditarVersao(versao.status);

  const contas = await prisma.contaContabil.findMany({
    where: { tenantId, isAnalitica: true },
    orderBy: { codigoErp: 'asc' },
    select: { id: true, codigoErp: true, nomeConta: true },
  });
  const contasAnaliticas = contas.map((c) => ({ id: c.id, label: `${c.codigoErp} — ${c.nomeConta}` }));

  let metaInicial = null;
  if (guiaAtiva === 'meta') {
    const meta = await prisma.meta.findFirst({ where: { tenantId, versaoId: versao.id, ativo: true } });
    metaInicial = meta
      ? { id: meta.id, tipo: meta.tipo, nome: meta.nome, valorGlobal: meta.valorGlobal.toString(), status: meta.status, observacao: meta.observacao }
      : null;
  }

  let cargos: { id: string; label: string }[] = [];
  let empregados: (import('@/app/plano-contas/actions').EmpregadoResultado & { categoria: 'EMPREGADO' | 'ESTAGIARIO' | 'JOVEM_APRENDIZ' })[] = [];
  let qtdeEmpregados: import('@/app/plano-contas/actions').QtdeEmpregadoResultado[] = [];
  // Empregado/Qtde. Empregado exigem Meta cadastrada quando a Proposta é POR_META (CadastrarEmpregadoUseCase/
  // CadastrarQtdeEmpregadoUseCase lançam MetaNaoEncontradaError) — aviso proativo na tela, antes do usuário tentar salvar.
  let temMetaConfigurada = true;
  if (guiaAtiva === 'empregados') {
    if (proposta.categoria === 'POR_META') {
      const meta = await prisma.meta.findFirst({ where: { tenantId, versaoId: versao.id, ativo: true } });
      temMetaConfigurada = meta !== null;
    }
    const [cargosDb, empregadosDb, qtdeDb] = await Promise.all([
      prisma.cargo.findMany({
        where: { tenantId, propostaId: id, ativo: true },
        orderBy: { codigoCargo: 'asc' },
        select: { id: true, codigoCargo: true, nomeCargoMercado: true },
      }),
      prisma.empregadoHeadcount.findMany({
        where: { tenantId, propostaId: id, ativo: true },
        select: {
          id: true,
          nome: true,
          categoria: true,
          vinculoFuncionalHerdado: true,
          custoTotalMensal: true,
          contaId: true,
          cargoId: true,
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
      prisma.qtdeEmpregado.findMany({
        where: { tenantId, propostaId: id, ativo: true },
        select: {
          id: true,
          numeroDocumento: true,
          quantidadeEmpregados: true,
          quantidadeEstagiarios: true,
          quantidadeJovemAprendiz: true,
          valorTotalConsolidado: true,
        },
      }),
    ]);
    cargos = cargosDb.map((c) => ({ id: c.id, label: `${c.codigoCargo} — ${c.nomeCargoMercado}` }));
    empregados = empregadosDb.map((e) => ({
      id: e.id,
      nome: e.nome,
      categoria: e.categoria,
      vinculoFuncionalHerdado: e.vinculoFuncionalHerdado,
      custoTotalMensal: e.custoTotalMensal.toString(),
      contaId: e.contaId,
      cargoId: e.cargoId,
      valorSalarioSnapshot: e.valorSalarioSnapshot.toString(),
      valorGratificacaoSnapshot: e.valorGratificacaoSnapshot.toString(),
      valorEncargosSociaisSnapshot: e.valorEncargosSociaisSnapshot.toString(),
      valorValeAlimentacaoSnapshot: e.valorValeAlimentacaoSnapshot.toString(),
      valorValeRefeicaoSnapshot: e.valorValeRefeicaoSnapshot.toString(),
      valorValeTransporteSnapshot: e.valorValeTransporteSnapshot.toString(),
      valorPlanoOdontologicoSnapshot: e.valorPlanoOdontologicoSnapshot.toString(),
      valorSeguroVidaSnapshot: e.valorSeguroVidaSnapshot.toString(),
      valorPlanoSaudeSnapshot: e.valorPlanoSaudeSnapshot.toString(),
      valorAuxilioCrecheSnapshot: e.valorAuxilioCrecheSnapshot.toString(),
    }));
    qtdeEmpregados = qtdeDb.map((q) => ({ ...q, valorTotalConsolidado: q.valorTotalConsolidado.toString() }));
  }

  let viagensIniciais: import('@/app/plano-contas/actions').ViagemResultado[] = [];
  if (guiaAtiva === 'viagens') {
    const viagensDb = await prisma.viagem.findMany({
      where: { tenantId, versaoId: versao.id, ativo: true },
      select: {
        id: true,
        descricao: true,
        custoEstimado: true,
        quantidadePessoas: true,
        mediaDias: true,
        custoUnitarioPassagem: true,
        contaPassagemId: true,
        custoUnitarioDiaria: true,
        contaDiariaId: true,
        custoUnitarioTransporte: true,
        contaTransporteId: true,
      },
    });
    viagensIniciais = viagensDb.map((v) => ({
      id: v.id,
      descricao: v.descricao,
      custoEstimado: v.custoEstimado.toString(),
      quantidadePessoas: v.quantidadePessoas,
      mediaDias: v.mediaDias,
      custoUnitarioPassagem: v.custoUnitarioPassagem.toString(),
      contaPassagemId: v.contaPassagemId,
      custoUnitarioDiaria: v.custoUnitarioDiaria.toString(),
      contaDiariaId: v.contaDiariaId,
      custoUnitarioTransporte: v.custoUnitarioTransporte.toString(),
      contaTransporteId: v.contaTransporteId,
    }));
  }

  let itensIniciais: import('@/app/plano-contas/actions').ItemPatrimonialResultado[] = [];
  if (guiaAtiva === 'bens') {
    const itensDb = await prisma.itemPatrimonial.findMany({
      where: { tenantId, versaoId: versao.id, ativo: true },
      select: { id: true, descricao: true, valorTotal: true },
    });
    itensIniciais = itensDb.map((i) => ({ id: i.id, descricao: i.descricao, valorTotal: i.valorTotal.toString() }));
  }

  let cronogramaLinhas: import('../../cronogramaTipos').LinhaCronogramaSerializada[] = [];
  let metaNomeCronograma: string | null = null;
  if (guiaAtiva === 'cronograma-desembolso') {
    const [empregadosCronograma, viagensCronograma, itensCronograma, rateiosCronograma, metaCronograma] = await Promise.all([
      prisma.empregadoHeadcount.findMany({
        where: { tenantId, propostaId: id, ativo: true },
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
      prisma.rateioImpostoGrade.findMany({ where: { tenantId, versaoId: versao.id, ativo: true }, select: { competencia: true, valorDeclarado: true } }),
      prisma.meta.findFirst({ where: { tenantId, versaoId: versao.id, ativo: true }, select: { nome: true } }),
    ]);

    metaNomeCronograma = metaCronograma?.nome ?? null;
    // Cenário 8/US-122 — Proposta sem nenhum dado financeiro cadastrado bloqueia a
    // grade inteira (não é "12 meses zerados", é "operação rejeitada").
    const temDadosFinanceiros =
      empregadosCronograma.length > 0 || viagensCronograma.length > 0 || itensCronograma.length > 0 || rateiosCronograma.length > 0;

    if (temDadosFinanceiros) {
      const linhas = montarCronogramaDesembolso(
        { dataInicio: proposta.dataInicio, dataFim: proposta.dataFim },
        empregadosCronograma,
        viagensCronograma,
        itensCronograma,
        rateiosCronograma,
      );
      cronogramaLinhas = linhas.map((l) => ({
        mes: l.mes,
        competencia: l.competencia.toISOString(),
        desembolsoMensal: l.desembolsoMensal.toString(),
        desembolsoAcumulado: l.desembolsoAcumulado.toString(),
        percentualFinanceiroAcumulado: l.percentualFinanceiroAcumulado.toString(),
        valorRepassado12Meses: l.valorRepassado12Meses?.toString() ?? null,
      }));
    }
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">{proposta.nome}</h1>
        <p className="text-sm text-gray-500">
          {proposta.codigo} — Versão {versao.numeroVersao} ({versao.status}) — {proposta.tipo === 'CONTRATO' ? 'Contrato' : 'Termo de Parceria'} —{' '}
          {proposta.categoria === 'CONSOLIDADA' ? 'Consolidada' : 'Por Meta'}
        </p>
        <p className="text-xs text-gray-400">
          {proposta.dataInicio.toLocaleDateString('pt-BR')} a {proposta.dataFim.toLocaleDateString('pt-BR')}
        </p>
        {readOnly && (
          <p className="mt-1 text-xs font-medium text-orange-700">
            Versão {versao.status === 'OFICIALIZADO' ? 'oficializada' : 'encerrada'} — somente leitura.
          </p>
        )}
      </header>

      <PropostaTabs propostaId={id} guias={GUIAS} guiaAtiva={guiaAtiva} />

      <section>
        {guiaAtiva === 'valor-orcado' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Link
                href="/propostas"
                className="rounded-lg border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm hover:shadow-md"
              >
                &larr; Voltar para Propostas
              </Link>
            </div>
            <ValorOrcadoResumoPanel tenantId={tenantId} propostaId={id} versaoId={versao.id} />
          </div>
        )}

        {guiaAtiva === 'lancar-valor-orcado' && (
          <ValorOrcadoContaForm versaoId={versao.id} contasAnaliticas={contasAnaliticas} readOnly={readOnly} />
        )}

        {guiaAtiva === 'semaforo' && (
          <BadgeSemaforoPanel tenantId={tenantId} versaoId={versao.id} contasAnaliticas={contasAnaliticas} />
        )}

        {guiaAtiva === 'meta' && <MetaPanel versaoId={versao.id} metaInicial={metaInicial} readOnly={readOnly} />}

        {guiaAtiva === 'empregados' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Link
                href={`/propostas/${id}/estrutura`}
                className="flex items-center gap-1 rounded-lg border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm hover:shadow-md"
              >
                Estrutura Funcional e Cargos &rarr;
              </Link>
            </div>
            <EmpregadoPanel
              propostaId={id}
              cargos={cargos}
              empregadosIniciais={empregados}
              qtdeEmpregadosIniciais={qtdeEmpregados}
              contasAnaliticas={contasAnaliticas}
              readOnly={readOnly}
              propostaCategoria={proposta.categoria}
              temMetaConfigurada={temMetaConfigurada}
            />
          </div>
        )}

        {guiaAtiva === 'viagens' && (
          <ViagemPanel versaoId={versao.id} contasAnaliticas={contasAnaliticas} viagensIniciais={viagensIniciais} readOnly={readOnly} />
        )}

        {guiaAtiva === 'bens' && (
          <ItemPatrimonialPanel versaoId={versao.id} contasAnaliticas={contasAnaliticas} itensIniciais={itensIniciais} readOnly={readOnly} />
        )}

        {guiaAtiva === 'rateio-impostos' && (
          <RateioImpostoPanelHost tenantId={tenantId} usuarioId={usuario.id} versaoId={versao.id} contasAnaliticas={contasAnaliticas} readOnly={readOnly} />
        )}

        {guiaAtiva === 'termo-ajuste' && (
          <TermoAjusteHost tenantId={tenantId} usuarioId={usuario.id} versaoId={versao.id} contasAnaliticas={contasAnaliticas} />
        )}

        {guiaAtiva === 'cronograma-desembolso' && (
          <CronogramaDesembolsoPanel
            nomeProposta={proposta.nome}
            codigoProposta={proposta.codigo}
            versaoNumero={versao.numeroVersao}
            metaNome={metaNomeCronograma}
            linhas={cronogramaLinhas}
          />
        )}
      </section>
    </main>
  );
}

async function RateioImpostoPanelHost({
  tenantId,
  usuarioId,
  versaoId,
  contasAnaliticas,
  readOnly,
}: {
  tenantId: string;
  usuarioId: string;
  versaoId: string;
  contasAnaliticas: { id: string; label: string }[];
  readOnly: boolean;
}) {
  const [podeConfigurarRateioImposto, aliquotas] = await Promise.all([
    usuarioTemFuncionalidade(prisma, tenantId, usuarioId, 'plano-contas.configurar-rateio-imposto'),
    prisma.aliquotaImpostoParametro.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, aliquotaPct: true },
    }),
  ]);

  if (!podeConfigurarRateioImposto) {
    return <p className="text-sm text-gray-500">Sem permissão para visualizar Rateio de Impostos.</p>;
  }

  const aliquotasOpcoes = aliquotas.map((a) => ({ id: a.id, label: `${a.nome} (${a.aliquotaPct.toString()}%)` }));

  return (
    <RateioImpostoPanel versaoId={versaoId} contasAnaliticas={contasAnaliticas} aliquotas={aliquotasOpcoes} readOnly={readOnly} />
  );
}

async function TermoAjusteHost({
  tenantId,
  usuarioId,
  versaoId,
  contasAnaliticas,
}: {
  tenantId: string;
  usuarioId: string;
  versaoId: string;
  contasAnaliticas: { id: string; label: string }[];
}) {
  const [podeAprovarN1, podeHomologarGestorMaster, termosAjuste] = await Promise.all([
    usuarioTemFuncionalidade(prisma, tenantId, usuarioId, 'termo-ajuste.aprovar-n1'),
    usuarioTemFuncionalidade(prisma, tenantId, usuarioId, 'termo-ajuste.homologar-gestor-master'),
    getListarTermosAjusteUseCase().execute(tenantId, versaoId),
  ]);

  return (
    <TermoAjustePanel
      versaoId={versaoId}
      contasAnaliticas={contasAnaliticas}
      termosIniciais={termosAjuste.map((t) => ({
        id: t.id,
        contaOrigemLabel: t.contaOrigemLabel,
        contaDestinoLabel: t.contaDestinoLabel,
        exercicio: t.exercicio,
        valor: t.valor.toString(),
        status: t.status,
        updatedAt: t.updatedAt.toISOString(),
      }))}
      podeAprovarN1={podeAprovarN1}
      podeHomologarGestorMaster={podeHomologarGestorMaster}
    />
  );
}
