import { headers } from 'next/headers';

/**
 * Resolve o tenant da requisição atual. Placeholder de single-tenant enquanto o
 * middleware de propagação de tenant (multi-tenant) não é implementado — ver ADR
 * de isolamento multi-tenant no techlead-fsg (Tenant Mode) para a versão definitiva.
 */
export async function getTenantId(): Promise<string> {
  const headerList = await headers();
  return headerList.get('x-tenant-id') ?? 'default';
}
