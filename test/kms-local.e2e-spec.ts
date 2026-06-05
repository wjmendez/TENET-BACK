import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { IssuerService } from '../src/issuer/issuer.service.js';
import { VeramoService } from '../src/veramo/veramo.service.js';
import { basePrisma } from '../src/common/prisma/prisma.js';
import { runWithTenant } from '../src/common/tenant/tenant-context.js';

const MASTER_KEY = Buffer.from('kms-local-key-for-tests-32-bytes').toString('base64');

describe('Local KMS (e2e)', () => {
  let app: INestApplication;
  let issuerService: IssuerService;
  let veramoService: VeramoService;
  let tenantId: string;
  let issuerDid: string;

  beforeAll(async () => {
    process.env.LOCAL_KMS_MASTER_KEY = MASTER_KEY;
    process.env.APP_URL = 'http://localhost:3100';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    issuerService = app.get(IssuerService);
    veramoService = app.get(VeramoService);

    tenantId = await basePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;
      const tenant = await tx.tenant.create({
        data: {
          name: 'KMS Tenant',
          slug: `kms-${randomUUID().slice(0, 8)}`,
          status: 'ACTIVE',
          branding: {
            create: {
              subdomain: `kms-${randomUUID().slice(0, 8)}`,
              domainStatus: 'ACTIVE',
            },
          },
        },
      });
      return tenant.id;
    });

    const issuer = await runWithTenant(tenantId, () => issuerService.createIssuer({
      name: 'KMS Issuer',
    }));
    issuerDid = issuer.did;
  });

  afterAll(async () => {
    await basePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      await tx.issuer.deleteMany({ where: { tenantId } });
      await tx.tenantBranding.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
    });
    await app.close();
  });

  it('imports issuer key material into Veramo', async () => {
    const identifier = await veramoService.getDid(issuerDid);
    expect(identifier).toBeTruthy();
    expect(identifier?.did).toBe(issuerDid);
    expect(Array.isArray(identifier?.keys)).toBe(true);
    expect(identifier?.keys?.length).toBeGreaterThan(0);
  });
});
