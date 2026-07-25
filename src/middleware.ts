import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Rotas acessíveis sem sessão do Clerk: tela de login (UC01.01) e o webhook
// (autenticado por assinatura svix, não por sessão) [src/app/api/webhooks/clerk/route.ts].
const isRotaPublica = createRouteMatcher(['/login', '/api/webhooks/clerk']);

export default clerkMiddleware(async (auth, req) => {
  if (!isRotaPublica(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)'],
};
