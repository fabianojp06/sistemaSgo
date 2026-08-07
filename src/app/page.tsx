import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { BotaoAjuda } from './ajuda/BotaoAjuda';
import { BotaoSair } from './logoff/BotaoSair';
import { MenuLateral } from './MenuLateral';
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
    <main className="flex min-h-screen flex-col bg-[#F7F8FA] dark:bg-[#12151C]">
      <header className="grid grid-cols-3 items-center border-b border-[#DDE2EA] bg-white px-6 py-3.5 dark:border-[#2B303C] dark:bg-[#191D26]">
        <div className="text-sm">
          <p className="font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">{usuario?.nomeCompleto ?? 'Usuário'}</p>
          <p className="text-[#8A8F98] dark:text-[#767C89]">{dataHoraAcesso}</p>
        </div>
        <p className="text-center text-lg font-bold text-[#1A1F29] dark:text-[#EBEDF2]">Sistema de Gestão Orçamentária</p>
        <div className="flex items-center justify-end gap-2">
          <BotaoAjuda />
          <BotaoSair />
        </div>
      </header>

      {menu.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm rounded-[10px] border border-[#DDE2EA] bg-white p-6 text-center shadow-[0_1px_2px_rgba(20,24,33,0.05),0_1px_1px_rgba(20,24,33,0.04)] dark:border-[#2B303C] dark:bg-[#191D26]">
            <p className="text-sm text-[#5B6270] dark:text-[#A4AAB6]">
              Nenhuma funcionalidade disponível para o seu perfil de acesso. Contate o Administrador.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1">
          <MenuLateral menu={menu} />
          <div className="flex-1 bg-[#F7F8FA] p-6 dark:bg-[#12151C]" />
        </div>
      )}
    </main>
  );
}
