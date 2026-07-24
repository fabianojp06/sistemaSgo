import { prisma } from '@/infrastructure/db/prisma';
import { ObterMenuUsuarioUseCase } from './ObterMenuUsuarioUseCase';

export function getObterMenuUsuarioUseCase(): ObterMenuUsuarioUseCase {
  return new ObterMenuUsuarioUseCase(prisma);
}
