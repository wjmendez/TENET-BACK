import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service.js';
import { CertificateController } from './certificate.controller.js';


@Module({
  providers: [CertificateService],
  controllers: [CertificateController],
  exports: [CertificateService],
})
export class CertificateModule {}
