import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

export const basePrisma = new PrismaClient();
const prismaStorage = new AsyncLocalStorage<PrismaClientLike>();

export function runWithPrisma<T>(client: PrismaClientLike, callback: () => Promise<T>): Promise<T> {
  return prismaStorage.run(client, callback);
}

export const prisma: PrismaClient = new Proxy(basePrisma as PrismaClientLike, {
  get(_target, prop) {
    if (prop === '$transaction') {
      return (basePrisma as any)[prop].bind(basePrisma);
    }
    const client = prismaStorage.getStore() ?? basePrisma;
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
}) as PrismaClient;
