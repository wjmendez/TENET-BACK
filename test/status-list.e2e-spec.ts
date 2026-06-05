import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { basePrisma } from '../src/common/prisma/prisma.js';

const STATUS_PURPOSE = 'revocation';

function buildEmptyEncodedList(listSize: number) {
  const byteLength = Math.ceil(listSize / 8);
  const buffer = Buffer.alloc(byteLength, 0);
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

describe('Status List 2021 (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let tenantSlug: string;
  let issuerId: string;
  let issuerDid: string;
  let statusListId: string;

  beforeAll(async () => {
    process.env.TENANT_BASE_DOMAIN = 'example.test';
    process.env.APP_URL = 'http://localhost:3100';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    tenantSlug = `status-${randomUUID().slice(0, 8)}`;
    await basePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;

      const tenant = await tx.tenant.create({
        data: {
          name: 'Status List Tenant',
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
      tenantId = tenant.id;

      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;

      const issuer = await tx.issuer.create({
        data: {
          tenantId: tenant.id,
          did: `did:web:${tenantSlug}.example.test:issuers:${randomUUID()}`,
          name: 'Status Issuer',
          publicKeyJwk: {},
        },
      });
      issuerId = issuer.id;
      issuerDid = issuer.did;

      const statusList = await tx.statusList.create({
        data: {
          tenantId: tenant.id,
          issuerId: issuer.id,
          statusPurpose: STATUS_PURPOSE,
          listSize: 16,
          nextIndex: 0,
          encodedList: buildEmptyEncodedList(16),
        },
      });
      statusListId = statusList.id;
    });
  });

  afterAll(async () => {
    await basePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await tx.statusList.deleteMany({ where: { tenantId } });
      await tx.issuer.deleteMany({ where: { tenantId } });
      await tx.tenantBranding.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
    });

    await app.close();
  });

  it('serves status list credential', async () => {
    await request.default(app.getHttpServer())
      .get(`/.well-known/status/${statusListId}`)
      .set('Host', `${tenantSlug}.example.test`)
      .expect(200)
      .expect((res) => {
        expect(res.body.type).toContain('StatusList2021Credential');
        expect(res.body.issuer).toBe(issuerDid);
        expect(res.body.credentialSubject.statusPurpose).toBe(STATUS_PURPOSE);
        expect(typeof res.body.credentialSubject.encodedList).toBe('string');
      });
  });
});
