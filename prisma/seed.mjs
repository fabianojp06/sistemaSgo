// Seed idempotente [ADR-001] — garante que o perfil "Administrador" exista por tenant
// e esteja atribuído a todo Usuario cujo Clerk publicMetadata.role === 'ADMIN'
// [mesma regra de src/infrastructure/auth/clerk.ts#ehAdministrador].
// Sem módulos/funcionalidades reais ainda, o perfil nasce sem permissões — passa a
// recebê-las automaticamente assim que o primeiro módulo de negócio for seedado.
import { PrismaClient } from '@prisma/client';
import { createClerkClient } from '@clerk/backend';

const prisma = new PrismaClient();

async function seedModuloPlanoContas() {
  const modulo = await prisma.modulo.upsert({
    where: { chave: 'cadastros' },
    update: {},
    create: { chave: 'cadastros', nome: 'Cadastros' },
  });

  await prisma.funcionalidade.upsert({
    where: { moduloId_chave: { moduloId: modulo.id, chave: 'plano-contas.visualizar' } },
    update: {},
    create: { moduloId: modulo.id, chave: 'plano-contas.visualizar', nome: 'Visualizar Plano de Contas' },
  });

  await prisma.funcionalidade.upsert({
    where: { moduloId_chave: { moduloId: modulo.id, chave: 'plano-contas.sincronizar' } },
    update: {},
    create: { moduloId: modulo.id, chave: 'plano-contas.sincronizar', nome: 'Sincronizar Plano de Contas com ERP' },
  });

  await prisma.funcionalidade.upsert({
    where: { moduloId_chave: { moduloId: modulo.id, chave: 'plano-contas.classificar-natureza' } },
    update: {},
    create: { moduloId: modulo.id, chave: 'plano-contas.classificar-natureza', nome: 'Classificar Natureza de Conta' },
  });
}

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  console.log(`conectando em host=${url.host} user=${url.username} db=${url.pathname}`);

  await seedModuloPlanoContas();

  const totalUsuarios = await prisma.$queryRaw`SELECT count(*)::int AS total FROM "Usuario"`;
  console.log('contagem via SQL bruto:', JSON.stringify(totalUsuarios));

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

    // Administrador recebe automaticamente toda funcionalidade ativa de todo módulo
    // ativo — ver comentário do cabeçalho deste arquivo.
    const todasFuncionalidades = await prisma.funcionalidade.findMany({
      where: { ativo: true, modulo: { ativo: true } },
      select: { id: true },
    });
    for (const funcionalidade of todasFuncionalidades) {
      await prisma.perfilFuncionalidade.upsert({
        where: {
          perfilId_funcionalidadeId: { perfilId: perfilAdministrador.id, funcionalidadeId: funcionalidade.id },
        },
        update: {},
        create: { perfilId: perfilAdministrador.id, funcionalidadeId: funcionalidade.id },
      });
    }

    for (const usuario of usuarios.filter((u) => u.tenantId === tenantId)) {
      let clerkUser;
      try {
        clerkUser = await clerk.users.getUser(usuario.clerkUserId);
      } catch (error) {
        // Usuario órfão (clerkUserId não existe mais no Clerk) não pode travar o seed pros demais.
        console.error(`${usuario.clerkUserId}: não encontrado no Clerk, pulando —`, error.message ?? error);
        continue;
      }
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
