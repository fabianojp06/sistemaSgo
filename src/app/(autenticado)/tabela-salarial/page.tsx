import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import { listarTodaTabelaSalarial, listarSenioridades } from '../propostas/estrutura-actions';
import { TabelaSalarialListPanel } from './TabelaSalarialListPanel';

/**
 * US-131 (melhoria de visualização, pedido do usuário em 2026-08-13) — tela própria da
 * Tabela Salarial de mercado, sem depender de abrir um Cargo específico. Mutações
 * reaproveitam a permissão 'propostas.gerenciar-estrutura' (mesmo domínio de dado do Cargo).
 */
export default async function TabelaSalarialPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) redirect('/login');

  const [podeGerenciar, cargos, resultadoRegistros, resultadoSenioridades] = await Promise.all([
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'propostas.gerenciar-estrutura'),
    prisma.cargo.findMany({
      where: { tenantId, ativo: true },
      select: { id: true, nomeCargoMercado: true, codigoCargo: true },
      orderBy: { nomeCargoMercado: 'asc' },
    }),
    listarTodaTabelaSalarial(),
    listarSenioridades(),
  ]);

  const registros = resultadoRegistros.sucesso ? resultadoRegistros.dados : [];
  const senioridades = resultadoSenioridades.sucesso ? resultadoSenioridades.dados : [];
  const opcoesCargo = cargos.map((c) => ({ id: c.id, label: `${c.codigoCargo} — ${c.nomeCargoMercado}` }));

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tabela Salarial</h1>
          <p className="text-sm text-gray-500">Cadastros &gt; Cargos e Salários &gt; Tabela Salarial de mercado (UC03.19, seção 5)</p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm hover:shadow-md"
        >
          &larr; Página Inicial
        </Link>
      </header>

      {!resultadoRegistros.sucesso ? (
        <p className="text-sm text-red-600">{resultadoRegistros.mensagem}</p>
      ) : (
        <TabelaSalarialListPanel
          registrosIniciais={registros}
          senioridadesIniciais={senioridades}
          opcoesCargo={opcoesCargo}
          podeGerenciar={podeGerenciar}
        />
      )}
    </main>
  );
}
