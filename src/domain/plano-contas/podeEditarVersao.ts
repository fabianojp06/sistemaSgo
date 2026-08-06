import type { StatusProposta } from '@prisma/client';

/**
 * US-115 — mesma condição já checada inline em cada use case de escrita
 * (Cadastrar/Editar/Excluir Meta/Empregado/Viagem/ItemPatrimonial/QtdeEmpregado
 * etc.): só RASCUNHO/EM_ELABORACAO aceitam edição. Usado no client para refletir
 * o bloqueio antes do submit — o backend continua sendo a garantia real, nunca
 * confiar só neste helper.
 */
export function podeEditarVersao(status: StatusProposta): boolean {
  return status === 'RASCUNHO' || status === 'EM_ELABORACAO';
}
