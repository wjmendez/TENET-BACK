import { Module } from '@nestjs/common';
import { BundleService } from './bundle.service.js';
import { CertificateModule } from '../certificate/certificate.module.js';
import { AnchorModule } from '../anchor/anchor.module.js';
import { IssuanceModule } from '../issuance/issuance.module.js';
import { QuotaModule } from '../common/quota/quota.module.js';

@Module({
  imports: [CertificateModule, AnchorModule, IssuanceModule, QuotaModule],
  providers: [BundleService],
  controllers: [],
  exports: [BundleService],
})
export class BundleModule {}

