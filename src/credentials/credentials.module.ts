import { Module } from '@nestjs/common';
import { CredentialsController } from './credentials.controller.js';
import { IssuanceModule } from '../issuance/issuance.module.js';
import { CertificateModule } from '../certificate/certificate.module.js';

@Module({
  imports: [IssuanceModule, CertificateModule],
  controllers: [CredentialsController],
})
export class CredentialsModule {}

