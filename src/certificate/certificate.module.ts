import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service.js';
import { CertificateController } from './certificate.controller.js';
import { VeramoModule } from '../veramo/veramo.module.js';
import { StatusListModule } from '../status-list/status-list.module.js';
import { QuotaModule } from '../common/quota/quota.module.js';

@Module({
  imports: [VeramoModule, StatusListModule, QuotaModule],
  providers: [CertificateService],
  controllers: [CertificateController],
  exports: [CertificateService],
})
export class CertificateModule {}
