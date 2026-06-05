import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';
import { createHash, randomBytes } from 'node:crypto';
import { getTenantId } from '../common/tenant/tenant-context.js';


function normalizeScopes(scopes: unknown): string[] {
  if (Array.isArray(scopes)) {
    return scopes.map((scope) => String(scope));
  }
  if (typeof scopes === 'string') {
    return scopes.split(' ').filter(Boolean);
  }
  return [];
}

function generateApiKey() {
  const prefix = randomBytes(6).toString('hex');
  const secret = randomBytes(24).toString('hex');
  const raw = `${prefix}.${secret}`;
  const keyHash = createHash('sha256').update(raw).digest('hex');
  return { raw, prefix, keyHash };
}

function isSubset(required: string[], allowed: string[]): boolean {
  const allowedSet = new Set(allowed);
  return required.every((scope) => allowedSet.has(scope));
}

@Injectable()
export class ApiKeysService {
  async list(): Promise<any[]> {
    const tenantId = getTenantId();
    return prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        status: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
  }

  async create(data: { name: string; scopes: string[] }): Promise<any> {
    const tenantId = getTenantId();
    const scopes = Array.isArray(data.scopes) ? data.scopes : [];
    if (!data.name?.trim()) {
      throw new BadRequestException('name is required');
    }
    if (!scopes.length) {
      throw new BadRequestException('scopes are required');
    }

    const planScopes = await this.getActivePlanScopes(tenantId);
    if (!isSubset(scopes, planScopes)) {
      throw new BadRequestException('Requested scopes are outside the current plan');
    }

    const { raw, prefix, keyHash } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId,
        name: data.name,
        keyPrefix: prefix,
        keyHash,
        scopes,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        status: true,
        createdAt: true,
      },
    });

    return { ...apiKey, key: raw };
  }

  async revoke(id: string): Promise<any> {
    const tenantId = getTenantId();
    const existing = await prisma.apiKey.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    return prisma.apiKey.update({
      where: { id },
      data: { status: 'REVOKED' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        status: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
  }

  async rotate(id: string, scopes?: string[]): Promise<any> {
    const tenantId = getTenantId();
    const existing = await prisma.apiKey.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    const newScopes = Array.isArray(scopes) && scopes.length ? scopes : normalizeScopes(existing.scopes);
    if (!newScopes.length) {
      throw new BadRequestException('scopes are required');
    }

    const planScopes = await this.getActivePlanScopes(tenantId);
    if (!isSubset(newScopes, planScopes)) {
      throw new BadRequestException('Requested scopes are outside the current plan');
    }

    const { raw, prefix, keyHash } = generateApiKey();

    await prisma.apiKey.update({
      where: { id },
      data: { status: 'REVOKED' },
    });

    const newKey = await prisma.apiKey.create({
      data: {
        tenantId,
        name: existing.name,
        keyPrefix: prefix,
        keyHash,
        scopes: newScopes,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        status: true,
        createdAt: true,
      },
    });

    return { ...newKey, key: raw };
  }

  private async getActivePlanScopes(tenantId: string): Promise<string[]> {
    const now = new Date();
    const tenantPlan = await prisma.tenantPlan.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      include: { plan: true },
    });

    if (!tenantPlan) {
      return [];
    }

    const features = tenantPlan.plan.features as Record<string, unknown> | null;
    return normalizeScopes(features?.scopes ?? []);
  }
}
