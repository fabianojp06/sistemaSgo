import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

// Placeholder — a Tela Principal completa é UC01.03 (ainda não implementada).
// Serve, por ora, para expor os controles de autenticação e confirmar a sessão do Clerk.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-semibold">SGO — Sistema de Gestão Orçamentária</h1>
      <SignedOut>
        <SignInButton>
          <button className="rounded bg-blue-600 px-4 py-2 text-white">Entrar</button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </main>
  );
}
