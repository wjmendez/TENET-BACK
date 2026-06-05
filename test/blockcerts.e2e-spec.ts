import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { basePrisma } from '../src/common/prisma/prisma.js';
import { randomUUID } from 'node:crypto';

type BlockcertsFixture = {
  tenantId: string;
  tenantSlug: string;
  issuerId: string;
  issuerDid: string;
};

async function createBlockcertsFixture(): Promise<BlockcertsFixture> {
  return basePrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;

    const tenantSlug = `blockcerts-${randomUUID().slice(0, 8)}`;
    const tenant = await tx.tenant.create({
      data: {
        name: 'Blockcerts Tenant',
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
        name: 'Blockcerts Issuer',
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

async function cleanupBlockcertsFixture(fixture: BlockcertsFixture) {
  await basePrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${fixture.tenantId}, true)`;

    await tx.issuer.deleteMany({ where: { tenantId: fixture.tenantId } });
    await tx.tenantBranding.deleteMany({ where: { tenantId: fixture.tenantId } });
    await tx.tenant.deleteMany({ where: { id: fixture.tenantId } });
  });
}

describe('Blockcerts (e2e)', () => {
  let app: INestApplication;
  let fixture: BlockcertsFixture;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    process.env.TENANT_BASE_DOMAIN = 'example.test';
    fixture = await createBlockcertsFixture();
  });

  afterAll(async () => {
    await cleanupBlockcertsFixture(fixture);
    await app.close();
  });

  it('/issuer.json (GET)', () => {
    return request.default(app.getHttpServer())
      .get('/issuer.json')
      .set('Host', `${fixture.tenantSlug}.example.test`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(fixture.issuerDid);
      });
  });

  it('/revocationList.json (GET)', () => {
    return request.default(app.getHttpServer())
      .get(`/issuers/${fixture.issuerId}/revocationList.json`)
      .set('Host', `${fixture.tenantSlug}.example.test`)
      .expect(200)
      .expect((res) => {
        expect(res.body.type).toBe('RevocationList');
        expect(Array.isArray(res.body.revokedAssertions)).toBe(true);
      });
  });
});
