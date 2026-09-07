import type { PrismaClient } from '@prisma/client';
import type { PerfilAtivo } from './dtos';

/**
 * US-202 — lista os perfis ATIVOS do tenant com suas funcionalidades ativas,
 * para o painel "Perfil de acesso do usuário" e o painel "Funcionalidade(s) do Perfil".
 *
 * FUNDAÇÃO: stub. Corpo real na Frente C (feat/us-202-associar-perfis).
 */
export class ListarPerfisAtivosUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(_tenantId: string): Promise<PerfilAtivo[]> {
    throw new Error('ListarPerfisAtivosUseCase: não implementado (Frente C / US-202).');
  }
}
