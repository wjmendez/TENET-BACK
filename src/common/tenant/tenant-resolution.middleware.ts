import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { basePrisma } from '../prisma/prisma.js';

const DEFAULT_TENANT_HEADER = 'x-tenant-slug';
const DEFAULT_DOMAIN_STATUSES = ['VERIFIED', 'ACTIVE'] as const;

type TenantResolution = {
  tenantId: string;
  tenantSlug: string;
};

function getHeader(request: Request, name: string): string | null {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0] || null;
  }
  return null;
}

function getHost(request: Request): string | null {
  const forwarded = getHeader(request, 'x-forwarded-host');
  const hostHeader = forwarded || getHeader(request, 'host');
  if (!hostHeader) {
    return null;
  }
  const host = hostHeader.split(',')[0]?.trim().toLowerCase();
  if (!host) {
    return null;
  }
  return host.replace(/:\d+$/, '');
}

function extractSubdomain(host: string, baseDomain?: string): string | null {
  if (!baseDomain) {
    return null;
  }
  const normalizedBase = baseDomain.toLowerCase();
  if (host === normalizedBase) {
    return null;
  }
  if (!host.endsWith(`.${normalizedBase}`)) {
    return null;
  }
  const subdomain = host.slice(0, host.length - normalizedBase.length - 1);
  return subdomain || null;
}

@Injectable()
export class TenantResolutionMiddleware implements NestMiddleware {
  async use(req: Request & { tenantId?: string; tenantSlug?: string }, _res: Response, next: NextFunction) {
    const authHeader = getHeader(req, 'authorization');
    const apiKeyHeader = getHeader(req, 'x-api-key');
    if (authHeader || apiKeyHeader) {
      return next();
    }

    const tenantHeaderName = (process.env.TENANT_HEADER || DEFAULT_TENANT_HEADER).toLowerCase();
    const tenantSlug = getHeader(req, tenantHeaderName)?.trim().toLowerCase();
    const host = getHost(req);
    const baseDomain = process.env.TENANT_BASE_DOMAIN;
    const subdomain = host ? extractSubdomain(host, baseDomain) : null;

    if (!tenantSlug && !host && !subdomain) {
      return next();
    }

    const resolution = await this.resolveTenant(tenantSlug, host, subdomain);
    if (resolution) {
      req.tenantId = resolution.tenantId;
      req.tenantSlug = resolution.tenantSlug;
    }

    return next();
  }

  private async resolveTenant(
    tenantSlug?: string | null,
    host?: string | null,
    subdomain?: string | null,
  ): Promise<TenantResolution | null> {
    return basePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;

      if (tenantSlug) {
        const tenant = await tx.tenant.findFirst({
          where: { slug: tenantSlug, status: 'ACTIVE' },
          select: { id: true, slug: true },
        });
        if (tenant) {
          return { tenantId: tenant.id, tenantSlug: tenant.slug };
        }
      }

      if (host) {
        const byDomain = await tx.tenantBranding.findFirst({
          where: {
            customDomain: host,
            domainStatus: { in: [...DEFAULT_DOMAIN_STATUSES] },
            tenant: { status: 'ACTIVE' },
          },
          select: { tenant: { select: { id: true, slug: true } } },
        });
        if (byDomain?.tenant) {
          return { tenantId: byDomain.tenant.id, tenantSlug: byDomain.tenant.slug };
        }
      }

      if (subdomain) {
        const bySubdomain = await tx.tenantBranding.findFirst({
          where: {
            subdomain,
            tenant: { status: 'ACTIVE' },
          },
          select: { tenant: { select: { id: true, slug: true } } },
        });
        if (bySubdomain?.tenant) {
          return { tenantId: bySubdomain.tenant.id, tenantSlug: bySubdomain.tenant.slug };
        }
      }

      return null;
    });
  }
}
