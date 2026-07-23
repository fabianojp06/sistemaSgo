import { prisma } from '@/infrastructure/db/prisma';
import { getClerkClient } from '@/infrastructure/auth/clerk';
import { AutenticarUsuarioUseCase } from './AutenticarUsuarioUseCase';
import { BloquearUsuarioUseCase } from './BloquearUsuarioUseCase';

export async function getAutenticarUsuarioUseCase(): Promise<AutenticarUsuarioUseCase> {
  const clerk = await getClerkClient();
  const bloquearUsuario = new BloquearUsuarioUseCase(prisma);
  return new AutenticarUsuarioUseCase(prisma, clerk, bloquearUsuario);
}
