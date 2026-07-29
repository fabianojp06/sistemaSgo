import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tenantId = process.env.TENANT_ID || 'default';
const confirmar = process.env.CONFIRMAR === 'true';

async function main() {
  const contas = await prisma.contaContabil.findMany({
    where: { tenantId },
    select: { id: true, codigoErp: true },
  });
  console.log(`ContaContabil no tenant "${tenantId}": ${contas.length}`);

  if (contas.length === 0) {
    console.log('Nada a limpar.');
    return;
  }

  const contaIds = contas.map((c) => c.id);
  const itensAgrupador = await prisma.contaAgrupadoraItem.count({ where: { contaId: { in: contaIds } } });
  console.log(`ContaAgrupadoraItem vinculados a essas contas: ${itensAgrupador}`);

  if (!confirmar) {
    console.log('CONFIRMAR != "true" — modo somente leitura, nenhuma exclusão realizada.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (itensAgrupador > 0) {
      await tx.contaAgrupadoraItem.deleteMany({ where: { contaId: { in: contaIds } } });
    }
    await tx.contaContabil.deleteMany({ where: { tenantId } });
  });
  console.log(`Removidas ${contas.length} ContaContabil e ${itensAgrupador} ContaAgrupadoraItem do tenant "${tenantId}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
