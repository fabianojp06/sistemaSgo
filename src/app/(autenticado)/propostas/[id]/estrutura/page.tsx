import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import { EstruturaFuncionalPanel } from '../../EstruturaFuncionalPanel';
import { listarTodaTabelaSalarial, listarSenioridades } from '../../estrutura-actions';
import type { UnidadeFuncionalResultado, CargoResultado } from '../../estrutura-actions';

/** US-116/US-117 (UC03.18/UC03.19) — Estrutura Funcional (Organograma) + Cargos, por Proposta (não por Versão). */
export default async function EstruturaFuncionalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) redirect('/login');

  const proposta = await prisma.proposta.findFirst({ where: { tenantId, id } });
  if (!proposta) notFound();

  const readOnly = proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO';

  const podeGerenciar = await usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'propostas.gerenciar-estrutura');

  const [unidadesDb, cargosDb, contasDb] = await Promise.all([
    prisma.unidadeFuncional.findMany({
      where: { tenantId, propostaId: id, ativa: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, tipoNivel: true, idPai: true },
    }),
    prisma.cargo.findMany({
      where: { tenantId, propostaId: id, ativo: true },
      orderBy: { codigoCargo: 'asc' },
      include: { alocacoes: { select: { unidadeFuncionalId: true, percentual: true } } },
    }),
    prisma.contaContabil.findMany({
      where: { tenantId, isAnalitica: true },
      orderBy: { codigoErp: 'asc' },
      select: { id: true, codigoErp: true, nomeConta: true },
    }),
  ]);

  const cargoIds = new Set(cargosDb.map((c) => c.id));
  const [resultadoTabelaSalarial, resultadoSenioridades] = await Promise.all([listarTodaTabelaSalarial(), listarSenioridades()]);
  const tabelaSalarial = resultadoTabelaSalarial.sucesso ? resultadoTabelaSalarial.dados.filter((r) => cargoIds.has(r.cargoId)) : [];
  const senioridades = resultadoSenioridades.sucesso ? resultadoSenioridades.dados : [];

  const unidades: UnidadeFuncionalResultado[] = unidadesDb.map((u) => ({
    id: u.id,
    nome: u.nome,
    tipoNivel: u.tipoNivel,
    idPai: u.idPai,
  }));

  const cargos: (CargoResultado & { alocacoes: { unidadeFuncionalId: string; percentual: string }[] })[] = cargosDb.map((c) => ({
    id: c.id,
    codigoCargo: c.codigoCargo,
    nomeCargoMercado: c.nomeCargoMercado,
    contaId: c.contaId,
    fonteAtiva: c.fonteAtiva,
    salarioMercadoMinimo: c.salarioMercadoMinimo.toString(),
    salarioMercadoMaximo: c.salarioMercadoMaximo.toString(),
    origemSalarioMinimo: c.origemSalarioMinimo,
    origemSalarioMaximo: c.origemSalarioMaximo,
    funcaoGratificada: c.funcaoGratificada?.toString() ?? null,
    contaGratificacaoId: c.contaGratificacaoId,
    periodoInicio: c.periodoInicio.toISOString(),
    salarioReal: c.salarioReal?.toString() ?? null,
    salarioTotal: c.salarioTotal.toString(),
    custoTotalCargo: c.custoTotalCargo.toString(),
    encargosSociaisPct: c.encargosSociaisPct.toString(),
    contaEncargosSociaisId: c.contaEncargosSociaisId,
    vaAtivo: c.vaAtivo,
    vaValorUnitario: c.vaValorUnitario.toString(),
    contaValeAlimentacaoId: c.contaValeAlimentacaoId,
    vrAtivo: c.vrAtivo,
    vrValorUnitario: c.vrValorUnitario.toString(),
    contaValeRefeicaoId: c.contaValeRefeicaoId,
    planoSaudeAtivo: c.planoSaudeAtivo,
    planoSaudeFaixa: c.planoSaudeFaixa,
    planoSaudeValor: c.planoSaudeValor.toString(),
    contaPlanoSaudeId: c.contaPlanoSaudeId,
    planoOdontoAtivo: c.planoOdontoAtivo,
    planoOdontoValor: c.planoOdontoValor.toString(),
    contaPlanoOdontologicoId: c.contaPlanoOdontologicoId,
    seguroVidaAtivo: c.seguroVidaAtivo,
    seguroVidaValor: c.seguroVidaValor.toString(),
    contaSeguroVidaId: c.contaSeguroVidaId,
    auxilioCrecheAtivo: c.auxilioCrecheAtivo,
    auxilioCrecheValor: c.auxilioCrecheValor.toString(),
    contaAuxilioCrecheId: c.contaAuxilioCrecheId,
    transporteAtivo: c.transporteAtivo,
    transporteValorUnitario: c.transporteValorUnitario.toString(),
    contaValeTransporteId: c.contaValeTransporteId,
    alocacoes: c.alocacoes.map((a) => ({ unidadeFuncionalId: a.unidadeFuncionalId, percentual: a.percentual.toString() })),
  }));

  const contasAnaliticas = contasDb.map((c) => ({ id: c.id, label: `${c.codigoErp} — ${c.nomeConta}` }));

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <header>
        <Link href={`/propostas/${id}`} className="text-xs text-blue-700 hover:underline">
          &larr; Voltar para {proposta.nome}
        </Link>
        <h1 className="text-xl font-semibold">Estrutura Funcional e Cargos</h1>
        <p className="text-sm text-gray-500">{proposta.codigo} — {proposta.nome}</p>
        {readOnly && (
          <p className="mt-1 text-xs font-medium text-orange-700">
            Proposta {proposta.status === 'OFICIALIZADO' ? 'oficializada' : 'encerrada'} — somente leitura.
          </p>
        )}
      </header>

      {!podeGerenciar ? (
        <p className="text-sm text-gray-500">Sem permissão para visualizar Estrutura Funcional e Cargos.</p>
      ) : (
        <EstruturaFuncionalPanel
          propostaId={id}
          unidadesIniciais={unidades}
          cargosIniciais={cargos}
          contasAnaliticas={contasAnaliticas}
          tabelaSalarialIniciais={tabelaSalarial}
          senioridadesIniciais={senioridades}
          podeGerenciarTabelaSalarial={podeGerenciar}
          readOnly={readOnly}
        />
      )}
    </main>
  );
}
