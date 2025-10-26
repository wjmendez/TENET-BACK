import { Module } from '@nestjs/common';
import { BlockcertsController } from './blockcerts.controller.js';
import { BlockcertsService } from './blockcerts.service.js';
import { CertificateModule } from '../certificate/certificate.module.js';

@Module({
  imports: [CertificateModule],
  controllers: [BlockcertsController],
  providers: [BlockcertsService],
})
export class BlockcertsModule {}
