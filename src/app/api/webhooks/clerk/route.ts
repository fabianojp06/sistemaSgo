import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { NextResponse, type NextRequest } from 'next/server';
import { SincronizarUsuarioClerkUseCase } from '@/application/use-cases/usuarios/SincronizarUsuarioClerkUseCase';
import { prisma } from '@/infrastructure/db/prisma';

/**
 * Endpoint de webhook do Clerk — mantém Usuario (banco próprio) sincronizado com a
 * fonte de verdade de identidade [RN_AUTH_Clerk_BancoProprio.md]. Configurar no
 * dashboard do Clerk: eventos `user.created` e `user.updated`, apontando pra esta rota.
 * A assinatura é verificada via `CLERK_WEBHOOK_SIGNING_SECRET` — requisições sem
 * assinatura válida são rejeitadas antes de tocar o banco.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let evento;
  try {
    evento = await verifyWebhook(request);
  } catch {
    return NextResponse.json({ error: 'Assinatura de webhook inválida' }, { status: 400 });
  }

  // EP085/US-204 — no 1º login o usuário deixa de estar "aguardando acesso".
  if (evento.type === 'session.created') {
    const clerkUserId = evento.data.user_id;
    if (typeof clerkUserId === 'string') {
      await prisma.usuario.updateMany({
        where: { clerkUserId, situacaoAcesso: { in: ['CONVITE_PENDENTE', 'CONVITE_ENVIADO', 'FALHA_ENVIO_CONVITE'] } },
        data: { situacaoAcesso: 'ACESSO_ATIVO' },
      });
    }
    return NextResponse.json({ sincronizado: true, evento: 'session.created' });
  }

  if (evento.type !== 'user.created' && evento.type !== 'user.updated') {
    return NextResponse.json({ ignorado: evento.type });
  }

  const usuario = evento.data;
  const emailPrimario = usuario.email_addresses.find(
    (endereco) => endereco.id === usuario.primary_email_address_id,
  );

  if (!emailPrimario) {
    return NextResponse.json({ error: 'Usuário sem e-mail primário' }, { status: 422 });
  }

  const loginDerivado =
    (typeof usuario.username === 'string' && usuario.username.trim()) ||
    emailPrimario.email_address.split('@')[0];

  const sincronizarUsuario = new SincronizarUsuarioClerkUseCase(prisma);
  await sincronizarUsuario.execute({
    clerkUserId: usuario.id,
    tenantId: 'default', // single-tenant enquanto o middleware multi-tenant não existe [src/infrastructure/tenant.ts]
    nomeCompleto: [usuario.first_name, usuario.last_name].filter(Boolean).join(' ') || emailPrimario.email_address,
    email: emailPrimario.email_address,
    login: loginDerivado,
  });

  return NextResponse.json({ sincronizado: true });
}
