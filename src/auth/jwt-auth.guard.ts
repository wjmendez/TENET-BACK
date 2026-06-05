import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, importSPKI, jwtVerify } from 'jose';
import type { JWTVerifyGetKey, KeyLike } from 'jose';
import { createHash, timingSafeEqual } from 'node:crypto';
import { TenantStatus } from '@prisma/client';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { SCOPES_KEY } from './scopes.decorator.js';
import { basePrisma, prisma } from '../common/prisma/prisma.js';

const TEXT_ENCODER = new TextEncoder();
const API_KEY_HEADER = 'x-api-key';
const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function normalizeScopes(scopes: unknown): string[] {
  if (Array.isArray(scopes)) {
    return scopes.map((scope) => String(scope));
  }
  if (typeof scopes === 'string') {
    return scopes.split(' ').filter(Boolean);
  }
  return [];
}

function getHeader(request: any, name: string): string | null {
  if (!request?.headers) {
    return null;
  }
  const direct = request.headers[name] ?? request.headers[name.toLowerCase()];
  if (typeof direct === 'string') {
    return direct;
  }
  if (Array.isArray(direct)) {
    return direct[0] || null;
  }
  return null;
}

function parseApiKey(value: string): { prefix: string; raw: string } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const prefix = parts[0].trim();
  if (prefix.length < 6) {
    return null;
  }
  return { prefix, raw: trimmed };
}

function hashApiKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function hasRequiredScopes(current: string[], required: string[]): boolean {
  if (!required.length) {
    return true;
  }
  const set = new Set(current);
  return required.every((scope) => set.has(scope));
}

function isSuperadminEmail(email?: string | null): boolean {
  if (!email) {
    return false;
  }
  return SUPERADMIN_EMAILS.includes(String(email).toLowerCase());
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwksUrl = process.env.JWT_JWKS_URL || '';
  private readonly jwtIssuer = process.env.JWT_ISSUER || undefined;
  private readonly jwtAudience = process.env.JWT_AUDIENCE || undefined;
  private readonly jwtSecret = process.env.JWT_SECRET || '';
  private readonly jwtPublicKey = process.env.JWT_PUBLIC_KEY || '';
  private remoteKeySet?: ReturnType<typeof createRemoteJWKSet>;
  private publicKeyPromise?: Promise<Awaited<ReturnType<typeof importSPKI>>>;

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const rawUrl = request?.raw?.url || request?.url || '';
    const method = request?.method || '';

    if (isPublic || this.isPublicPath(rawUrl, method)) {
      return true;
    }

    const authHeader = getHeader(request, 'authorization');
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (!match) {
        throw new UnauthorizedException('Invalid Authorization header');
      }

      const token = match[1].trim();
      if (!token) {
        throw new UnauthorizedException('JWT token missing');
      }

      if (!this.jwtIssuer || !this.jwtAudience) {
        throw new UnauthorizedException('JWT issuer or audience not configured');
      }

      const key = await this.resolveKey();
      const verifyOptions = {
        issuer: this.jwtIssuer,
        audience: this.jwtAudience,
      };
      const { payload } =
        typeof key === 'function'
          ? await jwtVerify(token, key, verifyOptions)
          : await jwtVerify(token, key, verifyOptions);

      const tenantId = payload.tenantId as string | undefined;
      if (!tenantId) {
        throw new UnauthorizedException('tenantId missing in token');
      }

      const scopes = normalizeScopes(payload.scopes ?? payload.scope);

      const planData = await basePrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        const now = new Date();
        const tenantPlan = await tx.tenantPlan.findFirst({
          where: {
            tenantId,
            status: 'ACTIVE',
            periodStart: { lte: now },
            periodEnd: { gte: now },
          },
          include: { plan: true },
        });

        const features = tenantPlan?.plan?.features as Record<string, unknown> | null | undefined;
        return {
          scopes: normalizeScopes(features?.scopes ?? []),
          rateLimitRps: tenantPlan?.plan?.rateLimitRps ?? null,
        };
      });

      if (!hasRequiredScopes(planData.scopes, scopes)) {
        throw new ForbiddenException('JWT scopes exceed current plan');
      }

      request.auth = {
        sub: payload.sub,
        tenantId,
        email: payload.email,
        role: payload.role,
        scopes,
        claims: payload,
        authType: 'jwt',
        rateLimitRps: planData.rateLimitRps ?? undefined,
        isSuperadmin: isSuperadminEmail(payload.email as string | undefined),
      };
    } else {
      const rawApiKey = getHeader(request, API_KEY_HEADER);
      if (!rawApiKey) {
        throw new UnauthorizedException('Authorization or API key missing');
      }

      const parsed = parseApiKey(rawApiKey);
      if (!parsed) {
        throw new UnauthorizedException('Invalid API key format');
      }

      const authResult = await basePrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.auth_access', 'true', true)`;

        const apiKey = await tx.apiKey.findFirst({
          where: {
            keyPrefix: parsed.prefix,
            status: 'ACTIVE',
          },
          include: {
            tenant: true,
          },
        });

        if (!apiKey || apiKey.tenant.status !== TenantStatus.ACTIVE) {
          return null;
        }

        const computedHash = hashApiKey(parsed.raw);
        if (!safeEqualHex(computedHash, apiKey.keyHash)) {
          return null;
        }

        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${apiKey.tenantId}, true)`;

        await tx.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        });

        const tenantPlan = await tx.tenantPlan.findFirst({
          where: {
            tenantId: apiKey.tenantId,
            status: 'ACTIVE',
            periodStart: { lte: new Date() },
            periodEnd: { gte: new Date() },
          },
          include: { plan: true },
        });

        const features = tenantPlan?.plan?.features as Record<string, unknown> | null | undefined;
        const planScopes = normalizeScopes(features?.scopes ?? []);
        const rateLimitRps = tenantPlan?.plan?.rateLimitRps ?? null;

        return { apiKey, planScopes, rateLimitRps };
      });

      if (!authResult) {
        throw new UnauthorizedException('API key not valid');
      }

      const { apiKey, planScopes, rateLimitRps } = authResult;
      const scopes = normalizeScopes(apiKey.scopes);

      if (!hasRequiredScopes(planScopes, scopes)) {
        throw new ForbiddenException('API key scopes exceed current plan');
      }

      request.auth = {
        sub: null,
        tenantId: apiKey.tenantId,
        email: null,
        role: null,
        scopes,
        claims: {},
        authType: 'apiKey',
        apiKeyId: apiKey.id,
        apiKeyPrefix: apiKey.keyPrefix,
        rateLimitRps: rateLimitRps ?? undefined,
        isSuperadmin: false,
      };
    }

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (requiredScopes.length && !hasRequiredScopes(request.auth?.scopes || [], requiredScopes)) {
      throw new ForbiddenException('Missing required scopes');
    }

    return true;
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

  private isPublicPath(url: string, method: string) {
    if (method === 'OPTIONS') {
      return true;
    }

    const normalized = url.split('?')[0] || '';
    const publicPrefixes = ['/docs', '/docs-json'];
    if (publicPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      return true;
    }

    const publicPaths = [
      '/verifier.html',
      '/issuer.json',
      '/.well-known/did.json',
      '/well-known/did.json',
    ];

    if (publicPaths.includes(normalized)) {
      return true;
    }

    return false;
  }

  private async resolveKey(): Promise<JWTVerifyGetKey | KeyLike | Uint8Array> {
    if (this.jwksUrl) {
      if (!this.remoteKeySet) {
        this.remoteKeySet = createRemoteJWKSet(new URL(this.jwksUrl));
      }
      return this.remoteKeySet;
    }

    if (this.jwtPublicKey) {
      if (!this.publicKeyPromise) {
        this.publicKeyPromise = importSPKI(this.jwtPublicKey, 'RS256');
      }
      return this.publicKeyPromise;
    }

    if (this.jwtSecret) {
      return TEXT_ENCODER.encode(this.jwtSecret);
    }

    throw new UnauthorizedException('JWT verification keys not configured');
  }
}
