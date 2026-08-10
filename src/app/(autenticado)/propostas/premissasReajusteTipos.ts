import type { BlocoPremissa } from '@/application/use-cases/plano-contas/ListarPremissasReajusteUseCase';

export type CelulaPremissaSerializada =
  | { competencia: string; tag: 'REALIZADO' }
  | { competencia: string; tag: 'PROJETADO'; aliquotaPct: string }
  | { competencia: string; tag: 'SEM_INDICE' };

export type LinhaPremissaSerializada = {
  contaId: string;
  contaLabel: string;
  blocos: BlocoPremissa[];
  temIndice: boolean;
  celulas: CelulaPremissaSerializada[];
};
