import { Module } from '@nestjs/common';
import { VerticalService } from './vertical.service.js';
import { VerticalController } from './vertical.controller.js';
import { VerticalCredentialsController } from './vertical-credentials.controller.js';
import { VerticalBundlesController } from './vertical-bundles.controller.js';
import { VerticalSmartMedalsController } from './vertical-smart-medals.controller.js';
import { CertificateModule } from '../certificate/certificate.module.js';
import { BundleModule } from '../bundle/bundle.module.js';
import { SmartMedalModule } from '../smart-medal/smart-medal.module.js';

@Module({
  imports: [CertificateModule, BundleModule, SmartMedalModule],
  providers: [VerticalService],
  controllers: [
    VerticalController,
    VerticalCredentialsController,
    VerticalBundlesController,
    VerticalSmartMedalsController,
  ],
  exports: [VerticalService],
})
export class VerticalModule {}

