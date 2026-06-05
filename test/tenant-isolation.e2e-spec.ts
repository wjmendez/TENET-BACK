import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { basePrisma } from '../src/common/prisma/prisma.js';

type TenantFixture = {
  tenantId: string;
  tenantSlug: string;
  issuerId: string;
  issuerDid: string;
};

async function createTenantWithIssuer(tenantSlug: string, tenantName: string): Promise<TenantFixture> {
  return basePrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;

    const tenant = await tx.tenant.create({
      data: {
        name: tenantName,
        slug: tenantSlug,
        status: 'ACTIVE',
        branding: {
          create: {
            subdomain: tenantSlug,
            domainStatus: 'ACTIVE',
          },
        },
      },
    });

    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;

    const issuerId = randomUUID();
    const issuerDid = `did:web:${tenantSlug}.example.test:issuers:${issuerId}`;
    const issuer = await tx.issuer.create({
      data: {
        tenantId: tenant.id,
        did: issuerDid,
        name: `${tenantName} Issuer`,
        publicKeyJwk: {},
      },
    });

    return {
      tenantId: tenant.id,
      tenantSlug,
      issuerId: issuer.id,
      issuerDid: issuer.did,
    };
  });
}

async function cleanupTenants(fixtures: TenantFixture[]) {
  await basePrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;

    for (const fixture of fixtures) {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${fixture.tenantId}, true)`;
      await tx.issuer.deleteMany({ where: { tenantId: fixture.tenantId } });
      await tx.tenantBranding.deleteMany({ where: { tenantId: fixture.tenantId } });
      await tx.tenant.deleteMany({ where: { id: fixture.tenantId } });
    }
  });
}

describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  const fixtures: TenantFixture[] = [];

  beforeAll(async () => {
    process.env.TENANT_BASE_DOMAIN = 'example.test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    fixtures.push(await createTenantWithIssuer('tenant-a', 'Tenant A'));
    fixtures.push(await createTenantWithIssuer('tenant-b', 'Tenant B'));
  });

  afterAll(async () => {
    await cleanupTenants(fixtures);
    await app.close();
  });

  it('resolves issuer profile by tenant host', async () => {
    const [tenantA, tenantB] = fixtures;

    await request.default(app.getHttpServer())
      .get('/issuer.json')
      .set('Host', `${tenantA.tenantSlug}.example.test`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(tenantA.issuerDid);
      });

    await request.default(app.getHttpServer())
      .get('/issuer.json')
      .set('Host', `${tenantB.tenantSlug}.example.test`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(tenantB.issuerDid);
      });
  });

  it('blocks cross-tenant issuer access', async () => {
    const [tenantA, tenantB] = fixtures;

    await request.default(app.getHttpServer())
      .get(`/issuers/${tenantB.issuerId}/issuer.json`)
      .set('Host', `${tenantA.tenantSlug}.example.test`)
      .expect(404);
  });
});
