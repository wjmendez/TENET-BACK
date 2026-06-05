import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TemplateModule } from './template/template.module.js';
import { CertificateModule } from './certificate/certificate.module.js';
import { AnchorModule } from './anchor/anchor.module.js';
import { IssuerModule } from './issuer/issuer.module.js';
import { NFTModule } from './nft/nft.module.js';
import { VeramoModule } from './veramo/veramo.module.js';
import { VerticalModule } from './vertical/vertical.module.js';
import { CredentialTypeModule } from './credential-type/credential-type.module.js';
import { BundleModule } from './bundle/bundle.module.js';
import { UpdateModule } from './update/update.module.js';
import { SmartMedalModule } from './smart-medal/smart-medal.module.js';
import { IssuanceModule } from './issuance/issuance.module.js';
import { CredentialsModule } from './credentials/credentials.module.js';
import { BlockcertsModule } from './blockcerts/blockcerts.module.js';
import { ApiKeysModule } from './api-keys/api-keys.module.js';
import { AppService } from './app.service.js';
import { AppController } from './app.controller.js';
import { EventController } from './event.controller.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { TenantContextMiddleware } from './common/tenant/tenant.middleware.js';
import { TenantResolutionMiddleware } from './common/tenant/tenant-resolution.middleware.js';
import { AuthModule } from './auth/auth.module.js';
import { ControlPlaneModule } from './control-plane/control-plane.module.js';
import { TenantRlsInterceptor } from './common/prisma/tenant-rls.interceptor.js';
import { RateLimitInterceptor } from './common/rate-limit/rate-limit.interceptor.js';
import { RateLimitService } from './common/rate-limit/rate-limit.service.js';
import { StatusListModule } from './status-list/status-list.module.js';
import { QuotaModule } from './common/quota/quota.module.js';
import { QuotaInterceptor } from './common/quota/quota.interceptor.js';


@Module({
  imports: [
    TemplateModule,
    CertificateModule,
    AnchorModule,
    IssuerModule,
    NFTModule,
    VeramoModule,
    VerticalModule,
    CredentialTypeModule,
    BundleModule,
    UpdateModule,
    SmartMedalModule,
    IssuanceModule,
    CredentialsModule,
    BlockcertsModule,
    ApiKeysModule,
    AuthModule,
    ControlPlaneModule,
    StatusListModule,
    QuotaModule,
  ],
  controllers: [AppController, EventController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantRlsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: QuotaInterceptor,
    },
    RateLimitService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantResolutionMiddleware, TenantContextMiddleware).forRoutes('*');
  }
}
