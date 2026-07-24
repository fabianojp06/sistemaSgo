// Seed idempotente [ADR-001] — garante que o perfil "Administrador" exista por tenant
// e esteja atribuído a todo Usuario cujo Clerk publicMetadata.role === 'ADMIN'
// [mesma regra de src/infrastructure/auth/clerk.ts#ehAdministrador].
// Sem módulos/funcionalidades reais ainda, o perfil nasce sem permissões — passa a
// recebê-las automaticamente assim que o primeiro módulo de negócio for seedado.
import { PrismaClient } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';

const prisma = new PrismaClient();

async function main() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, tenantId: true, clerkUserId: true },
  });

  console.log(`usuarios encontrados: ${usuarios.length}`, JSON.stringify(usuarios));

  const tenants = [...new Set(usuarios.map((u) => u.tenantId))];

  for (const tenantId of tenants) {
    const perfilAdministrador = await prisma.perfil.upsert({
      where: { tenantId_nome: { tenantId, nome: 'Administrador' } },
      update: {},
      create: { tenantId, nome: 'Administrador' },
    });

    for (const usuario of usuarios.filter((u) => u.tenantId === tenantId)) {
      const clerkUser = await clerk.users.getUser(usuario.clerkUserId);
      const ehAdmin = clerkUser.publicMetadata?.role === 'ADMIN';
      console.log(`${usuario.clerkUserId}: publicMetadata=${JSON.stringify(clerkUser.publicMetadata)} ehAdmin=${ehAdmin}`);

      if (!ehAdmin) continue;

      await prisma.usuarioPerfil.upsert({
        where: { usuarioId_perfilId: { usuarioId: usuario.id, perfilId: perfilAdministrador.id } },
        update: {},
        create: { usuarioId: usuario.id, perfilId: perfilAdministrador.id, tenantId },
      });

      console.log(`Perfil "Administrador" atribuído a ${usuario.clerkUserId} [tenant ${tenantId}]`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
