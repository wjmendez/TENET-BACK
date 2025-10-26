import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('Blockcerts (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/issuer.json (GET)', () => {
    return request.default(app.getHttpServer())
      .get('/issuer.json')
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toContain('/issuer.json');
        expect(res.body.publicKey).toHaveLength(1);
      });
  });

  it('/revocationList.json (GET)', () => {
    return request.default(app.getHttpServer())
      .get('/revocationList.json')
      .expect(200)
      .expect((res) => {
        expect(res.body.type).toBe('RevocationList');
        expect(Array.isArray(res.body.revokedAssertions)).toBe(true);
      });
  });
});
