import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { basePrisma } from '../src/common/prisma/prisma.js';

async function createTenant(app: INestApplication, slug: string) {
  const email = `quota+${slug}@example.test`;
  const password = 'ChangeMe123!';

  const register = await request.default(app.getHttpServer())
    .post('/auth/register')
    .send({
      email,
      password,
      name: `Quota ${slug}`,
      tenantName: `Quota ${slug}`,
      tenantSlug: slug,
    })
    .expect(201);

  return {
    tenantId: register.body.tenantId as string,
    accessToken: register.body.accessToken as string,
    email,
    password,
    tenantSlug: slug,
  };
}

describe('Quota enforcement (e2e)', () => {
  let app: INestApplication;
  let tenantId: string;
  let accessToken: string;
  let planId: string;
  let email: string;
  let password: string;
  let tenantSlug: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const slug = `quota-${randomUUID().slice(0, 8)}`;
    const tenant = await createTenant(app, slug);
    tenantId = tenant.tenantId;
    accessToken = tenant.accessToken;
    email = tenant.email;
    password = tenant.password;
    tenantSlug = tenant.tenantSlug;

    await basePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;
      const plan = await tx.plan.create({
        data: {
          code: `QUOTA_${randomUUID().slice(0, 8)}`,
          version: 1,
          isActive: true,
          monthlyIssuanceQuota: 10,
          monthlyApiCallsQuota: 1,
          rateLimitRps: 10,
          features: { scopes: ['issuers:read'] },
        },
      });
      planId = plan.id;

      await tx.tenantPlan.updateMany({
        where: { tenantId, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });

      await tx.tenantPlan.create({
        data: {
          tenantId,
          planId: plan.id,
          periodStart: new Date(Date.now() - 1000),
          periodEnd: new Date(Date.now() + 1000 * 60 * 60),
          status: 'ACTIVE',
        },
      });
    });
    const login = await request.default(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password, tenantSlug })
      .expect(200);

    accessToken = login.body.accessToken as string;
  });

  afterAll(async () => {
    await basePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;
      await tx.quotaUsage.deleteMany({ where: { tenantId } });
      await tx.tenantPlan.deleteMany({ where: { tenantId } });
      await tx.tenantBranding.deleteMany({ where: { tenantId } });
      await tx.membership.deleteMany({ where: { tenantId } });
      await tx.user.deleteMany({ where: { email } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.plan.deleteMany({ where: { id: planId } });
    });
    await app.close();
  });

  it('blocks when api quota exceeded', async () => {
    await request.default(app.getHttpServer())
      .get('/auth/tenants')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request.default(app.getHttpServer())
      .get('/auth/tenants')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(429);
  });
});
