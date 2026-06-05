import { Module } from '@nestjs/common';
import { IssuanceService } from './issuance.service.js';
import { VeramoModule } from '../veramo/veramo.module.js';
import { CertificateModule } from '../certificate/certificate.module.js';

@Module({
  imports: [VeramoModule, CertificateModule],
  providers: [IssuanceService],
  exports: [IssuanceService],
})
export class IssuanceModule {}

