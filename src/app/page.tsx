import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { BotaoAjuda } from './ajuda/BotaoAjuda';
import { BotaoSair } from './logoff/BotaoSair';
import { getObterMenuUsuarioUseCase } from '@/application/use-cases/menu/container';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';

/**
 * UC01.03 — Exibir Tela Principal.
 * CA-01.03.01 — exibida imediatamente após o login, sem ação adicional do usuário.
 * CA-01.03.02–04 — menu filtrado por perfil [ADR-001], só módulos/funcionalidades ativos.
 * CA-01.03.05/06 — barra de status com nome completo, data/hora do acesso e botão Ajuda;
 * botão Sair sempre visível.
 * CA-01.03.18/19 [E4] — sem nenhuma permissão, exibe mensagem de menu vazio sem erro,
 * mantendo Sair e barra de status funcionais.
 */
export default async function TelaPrincipal() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({
    where: { tenantId, clerkUserId: userId },
    select: { id: true, nomeCompleto: true },
  });

  const menu = usuario ? await getObterMenuUsuarioUseCase().execute(tenantId, usuario.id) : [];

  const dataHoraAcesso = new Date().toLocaleString('pt-BR');

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="text-sm">
          <p className="font-medium">{usuario?.nomeCompleto ?? 'Usuário'}</p>
          <p className="text-gray-500">{dataHoraAcesso}</p>
        </div>
        <div className="flex items-center gap-2">
          <BotaoAjuda />
          <BotaoSair />
        </div>
      </header>

      {menu.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-gray-500">
          <p>Nenhuma funcionalidade disponível para o seu perfil de acesso. Contate o Administrador.</p>
        </div>
      ) : (
        <div className="flex flex-1">
          <nav className="w-64 border-r p-4">
            <ul className="space-y-4">
              {menu.map((modulo) => (
                <li key={modulo.chave}>
                  <p className="font-medium">{modulo.nome}</p>
                  <ul className="mt-1 space-y-1 pl-3 text-sm text-gray-500">
                    {modulo.funcionalidades.map((funcionalidade) => (
                      <li key={funcionalidade.chave}>{funcionalidade.nome}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex-1 p-6" />
        </div>
      )}
    </main>
  );
}
