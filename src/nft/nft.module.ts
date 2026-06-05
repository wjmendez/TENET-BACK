import { Module } from '@nestjs/common';
import { NFTController } from './nft.controller.js';
import { NFTService } from './nft.service.js';
import { CertificateModule } from '../certificate/certificate.module.js';
import { AnchorModule } from '../anchor/anchor.module.js';

@Module({
  imports: [CertificateModule, AnchorModule],
  controllers: [NFTController],
  providers: [NFTService],
  exports: [NFTService],
})
export class NFTModule {}




