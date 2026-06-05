import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { basePrisma } from '../src/common/prisma/prisma.js';

type TenantAuthFixture = {
  tenantId: string;
  tenantSlug: string;
  accessToken: string;
  apiKey: string;
};

type IssuerFixture = {
  issuerId: string;
  issuerDid: string;
};

async function createTenantViaRegister(app: INestApplication, tenantSlug: string): Promise<TenantAuthFixture> {
  const email = `owner+${tenantSlug}@example.test`;
  const password = 'ChangeMe123!';

  const register = await request.default(app.getHttpServer())
    .post('/auth/register')
    .send({
      email,
      password,
      name: `Owner ${tenantSlug}`,
      tenantName: `Tenant ${tenantSlug}`,
      tenantSlug,
    })
    .expect(201);

  const accessToken = register.body.accessToken as string;
  const tenantId = register.body.tenantId as string;

  const apiKeyResponse = await request.default(app.getHttpServer())
    .post('/api-keys')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      name: 'Test API Key',
      scopes: ['issuers:read'],
    })
    .expect(201);

  return {
    tenantId,
    tenantSlug,
    accessToken,
    apiKey: apiKeyResponse.body.key as string,
  };
}

async function createIssuerForTenant(tenantId: string, tenantSlug: string): Promise<IssuerFixture> {
  return basePrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

    const issuerId = randomUUID();
    const issuerDid = `did:web:${tenantSlug}.example.test:issuers:${issuerId}`;
    const issuer = await tx.issuer.create({
      data: {
        tenantId,
        did: issuerDid,
        name: `Issuer ${tenantSlug}`,
        publicKeyJwk: {},
      },
    });

    return {
      issuerId: issuer.id,
      issuerDid: issuer.did,
    };
  });
}

async function cleanupTenant(tenantId: string) {
  await basePrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

    await tx.apiKey.deleteMany({ where: { tenantId } });
    await tx.issuer.deleteMany({ where: { tenantId } });
    await tx.membership.deleteMany({ where: { tenantId } });
    await tx.tenantBranding.deleteMany({ where: { tenantId } });
    await tx.tenantPlan.deleteMany({ where: { tenantId } });
    await tx.quotaUsage.deleteMany({ where: { tenantId } });
    await tx.tenant.deleteMany({ where: { id: tenantId } });

    const users = await tx.user.findMany({
      where: { memberships: { none: {} } },
      select: { id: true },
    });
    if (users.length) {
      await tx.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    }
  });
}

describe('Tenant isolation (private endpoints)', () => {
  let app: INestApplication;
  let tenantA: TenantAuthFixture;
  let tenantB: TenantAuthFixture;
  let issuerB: IssuerFixture;

  beforeAll(async () => {
    process.env.TENANT_BASE_DOMAIN = 'example.test';
    process.env.REDIS_HOST = '';
    process.env.REDIS_PORT = '';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    tenantA = await createTenantViaRegister(app, `tenant-a-${randomUUID().slice(0, 8)}`);
    tenantB = await createTenantViaRegister(app, `tenant-b-${randomUUID().slice(0, 8)}`);
    issuerB = await createIssuerForTenant(tenantB.tenantId, tenantB.tenantSlug);
  });

  afterAll(async () => {
    await cleanupTenant(tenantA.tenantId);
    await cleanupTenant(tenantB.tenantId);
    await app.close();
  });

  it('blocks cross-tenant issuer access with JWT', async () => {
    await request.default(app.getHttpServer())
      .get(`/issuers/${issuerB.issuerId}`)
      .set('Authorization', `Bearer ${tenantA.accessToken}`)
      .expect(404);
  });

  it('blocks cross-tenant issuer access with API key', async () => {
    await request.default(app.getHttpServer())
      .get(`/issuers/${issuerB.issuerId}`)
      .set('x-api-key', tenantA.apiKey)
      .expect(404);
  });

  it('allows same-tenant issuer access', async () => {
    await request.default(app.getHttpServer())
      .get(`/issuers/${issuerB.issuerId}`)
      .set('Authorization', `Bearer ${tenantB.accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(issuerB.issuerId);
      });
  });
});
