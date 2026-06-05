import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';
import { SignJWT } from 'jose';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const TEXT_ENCODER = new TextEncoder();

function normalizeScopes(scopes: unknown): string[] {
  if (Array.isArray(scopes)) {
    return scopes.map((scope) => String(scope));
  }
  if (typeof scopes === 'string') {
    return scopes.split(' ').filter(Boolean);
  }
  return [];
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const salt = parts[1];
  const hashHex = parts[2];
  const derivedKey = scryptSync(password, salt, 64) as Buffer;
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (storedBuf.length !== derivedKey.length) {
    return false;
  }
  return timingSafeEqual(storedBuf, derivedKey);
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || 'tenant';
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

@Injectable()
export class AuthService {
  async login(data: { email: string; password: string; tenantSlug?: string }) {
    if (!data.email || !data.password) {
      throw new BadRequestException('email and password are required');
    }

    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (!user || !user.passwordHash || !verifyPassword(data.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const membership = await this.getMembership(user.id, data.tenantSlug);
    if (!membership) {
      throw new UnauthorizedException('User has no tenant access');
    }

    await prisma.$executeRaw`SELECT set_config('app.tenant_id', ${membership.tenantId}, true)`;
    const scopes = await this.getActivePlanScopes(membership.tenantId);
    const token = await this.signToken({
      sub: user.id,
      tenantId: membership.tenantId,
      email: user.email,
      role: membership.role,
      scopes,
    });

    return {
      accessToken: token,
      tokenType: 'Bearer',
      tenantId: membership.tenantId,
      role: membership.role,
      scopes,
    };
  }

  async createUser(data: { email: string; password: string; name?: string }) {
    const email = data.email.toLowerCase().trim();
    if (!email || !data.password) {
      throw new BadRequestException('email and password are required');
    }

    const passwordHash = hashPassword(data.password);
    return prisma.user.create({
      data: {
        email,
        name: data.name || null,
        passwordHash,
      },
    });
  }

  async register(data: {
    email: string;
    password: string;
    name?: string;
    tenantName?: string;
    tenantSlug?: string;
  }) {
    const email = data.email.toLowerCase().trim();
    if (!email || !data.password) {
      throw new BadRequestException('email and password are required');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('email already registered');
    }

    const baseName = data.tenantName?.trim() || data.name?.trim() || email.split('@')[0];
    const baseSlug = slugify(data.tenantSlug?.trim() || baseName || 'tenant');
    const tenantSlug = await this.ensureTenantSlug(baseSlug);

    const plan = await prisma.plan.findUnique({ where: { code: 'FREE' } });
    if (!plan) {
      throw new BadRequestException('Default plan not configured');
    }

    const passwordHash = hashPassword(data.password);
    const now = new Date();
    const periodStart = now;
    const periodEnd = addMonths(now, 1);

    const tenant = await prisma.tenant.create({
      data: {
        name: baseName || tenantSlug,
        slug: tenantSlug,
        status: 'ACTIVE',
        branding: {
          create: {
            subdomain: tenantSlug,
            domainStatus: 'PENDING',
          },
        },
      },
    });

    const user = await prisma.user.create({
      data: {
        email,
        name: data.name || null,
        passwordHash,
      },
    });

    await prisma.membership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: 'OWNER',
      },
    });

    await prisma.tenantPlan.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        periodStart,
        periodEnd,
        status: 'ACTIVE',
      },
    });

    const scopes = normalizeScopes(plan.features && (plan.features as Record<string, unknown>).scopes);
    const token = await this.signToken({
      sub: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: 'OWNER',
      scopes,
    });

    return {
      accessToken: token,
      tokenType: 'Bearer',
      tenantId: tenant.id,
      role: 'OWNER',
      scopes,
    };
  }

  async listUserTenants(userId: string) {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => ({
      tenantId: membership.tenantId,
      role: membership.role,
      tenant: membership.tenant,
    }));
  }

  private async getMembership(userId: string, tenantSlug?: string) {
    if (tenantSlug) {
      return prisma.membership.findFirst({
        where: { userId, tenant: { slug: tenantSlug } },
      });
    }

    const memberships = await prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { tenant: { select: { slug: true } } },
    });

    if (memberships.length === 1) {
      return memberships[0];
    }

    if (memberships.length > 1) {
      const options = memberships.map((membership) => membership.tenant.slug);
      throw new BadRequestException({
        message: 'Multiple tenants available. Provide tenantSlug to login.',
        tenants: options,
      });
    }

    return null;
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

    const features = tenantPlan?.plan?.features as Record<string, unknown> | null | undefined;
    return normalizeScopes(features?.scopes ?? []);
  }

  private async ensureTenantSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await prisma.tenant.findUnique({ where: { slug } });
      if (!existing) {
        return slug;
      }
      const suffix = randomBytes(2).toString('hex');
      slug = `${baseSlug}-${suffix}`;
    }
    throw new BadRequestException('Unable to allocate tenant slug');
  }

  private async signToken(payload: {
    sub: string;
    tenantId: string;
    email: string;
    role: string;
    scopes: string[];
  }) {
    const issuer = process.env.JWT_ISSUER || '';
    const audience = process.env.JWT_AUDIENCE || '';
    const secret = process.env.JWT_SECRET || '';

    if (!issuer || !audience || !secret) {
      throw new BadRequestException('JWT configuration missing');
    }

    return new SignJWT({
      tenantId: payload.tenantId,
      email: payload.email,
      role: payload.role,
      scopes: payload.scopes,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime('12h')
      .sign(TEXT_ENCODER.encode(secret));
  }
}
