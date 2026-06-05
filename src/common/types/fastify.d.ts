import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      sub?: string | null;
      tenantId: string;
      email?: string | null;
      role?: string | null;
      scopes: string[];
      claims: Record<string, unknown>;
      authType?: 'jwt' | 'apiKey';
      apiKeyId?: string;
      apiKeyPrefix?: string;
      rateLimitRps?: number;
      isSuperadmin?: boolean;
    };
    tenantId?: string;
    tenantSlug?: string;
  }
}
