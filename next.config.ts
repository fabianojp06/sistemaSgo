import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // No Codespaces, o proxy de port-forward injeta um `x-forwarded-host`
      // público diferente do `origin` real enviado pelo navegador
      // (`localhost:3000` ou o domínio de forward), o que o Next.js rejeita
      // por padrão como proteção contra CSRF em Server Actions.
      allowedOrigins: ['localhost:3000', '*.app.github.dev'],
    },
  },
};

export default nextConfig;
