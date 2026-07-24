import { prisma } from '@/infrastructure/db/prisma';
import { getClerkClient } from '@/infrastructure/auth/clerk';
import { AutenticarUsuarioUseCase } from './AutenticarUsuarioUseCase';
import { BloquearUsuarioUseCase } from './BloquearUsuarioUseCase';
import { EfetuarLogoffUseCase } from './EfetuarLogoffUseCase';

export async function getAutenticarUsuarioUseCase(): Promise<AutenticarUsuarioUseCase> {
  const clerk = await getClerkClient();
  const bloquearUsuario = new BloquearUsuarioUseCase(prisma);
  return new AutenticarUsuarioUseCase(prisma, clerk, bloquearUsuario);
}

export async function getEfetuarLogoffUseCase(): Promise<EfetuarLogoffUseCase> {
  const clerk = await getClerkClient();
  return new EfetuarLogoffUseCase(prisma, clerk);
}
