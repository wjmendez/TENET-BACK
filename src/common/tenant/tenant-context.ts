import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantContext = {
  tenantId: string;
};

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(tenantId: string, callback: () => T): T {
  return tenantStorage.run({ tenantId }, callback);
}

export function getTenantId(): string {
  const store = tenantStorage.getStore();
  if (!store?.tenantId) {
    throw new Error('Tenant context not set');
  }
  return store.tenantId;
}

export function getTenantIdOptional(): string | null {
  return tenantStorage.getStore()?.tenantId || null;
}
