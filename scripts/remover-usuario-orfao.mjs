import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const usuarioId = process.env.USUARIO_ID;
const confirmar = process.env.CONFIRMAR === 'true';

if (!usuarioId) {
  console.error('USUARIO_ID não informado — abortando.');
  process.exit(1);
}

async function main() {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) {
    console.log(`Nenhum Usuario com id=${usuarioId} encontrado. Nada a fazer.`);
    return;
  }
  console.log('Usuario encontrado:', JSON.stringify(usuario));

  const [perfis, historico] = await Promise.all([
    prisma.usuarioPerfil.count({ where: { usuarioId } }),
    prisma.historicoOperacao.count({ where: { usuarioId } }),
  ]);
  console.log(`Linhas filhas — UsuarioPerfil: ${perfis}, HistoricoOperacao: ${historico}`);

  if (!confirmar) {
    console.log('CONFIRMAR != "true" — modo somente leitura, nenhuma exclusão realizada.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (perfis > 0) await tx.usuarioPerfil.deleteMany({ where: { usuarioId } });
    // usuarioId é opcional em HistoricoOperacao — desvincula em vez de apagar
    // para preservar a trilha de auditoria.
    if (historico > 0) await tx.historicoOperacao.updateMany({ where: { usuarioId }, data: { usuarioId: null } });
    await tx.usuario.delete({ where: { id: usuarioId } });
  });
  console.log(`Usuario id=${usuarioId} removido (${perfis} UsuarioPerfil apagados, ${historico} HistoricoOperacao desvinculados).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
