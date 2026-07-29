import { prisma } from '@/infrastructure/db/prisma';
import { PlanoContasArquivoProvider } from '@/infrastructure/integrations/senior/PlanoContasArquivoProvider';
import { PlanoContasBulkLoader } from '@/infrastructure/plano-contas/PlanoContasBulkLoader';
import { SincronismoLockRepository } from '@/infrastructure/plano-contas/SincronismoLockRepository';
import { SincronizarPlanoContasUseCase } from './SincronizarPlanoContasUseCase';
import { CriarAgrupadorUseCase } from './CriarAgrupadorUseCase';
import { EditarAgrupadorUseCase } from './EditarAgrupadorUseCase';
import { ExcluirAgrupadorUseCase } from './ExcluirAgrupadorUseCase';
import { ListarAgrupadoresUseCase } from './ListarAgrupadoresUseCase';

export function getSincronizarPlanoContasUseCase(): SincronizarPlanoContasUseCase {
  return new SincronizarPlanoContasUseCase(
    prisma,
    new PlanoContasArquivoProvider(),
    new PlanoContasBulkLoader(prisma),
    new SincronismoLockRepository(prisma),
  );
}

export function getCriarAgrupadorUseCase(): CriarAgrupadorUseCase {
  return new CriarAgrupadorUseCase(prisma);
}

export function getEditarAgrupadorUseCase(): EditarAgrupadorUseCase {
  return new EditarAgrupadorUseCase(prisma);
}

export function getExcluirAgrupadorUseCase(): ExcluirAgrupadorUseCase {
  return new ExcluirAgrupadorUseCase(prisma);
}

export function getListarAgrupadoresUseCase(): ListarAgrupadoresUseCase {
  return new ListarAgrupadoresUseCase(prisma);
}
