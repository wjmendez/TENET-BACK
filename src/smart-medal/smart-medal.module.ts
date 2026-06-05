import { Module } from '@nestjs/common';
import { SmartMedalService } from './smart-medal.service.js';
import { NFTModule } from '../nft/nft.module.js';
import { UpdateModule } from '../update/update.module.js';
import { CertificateModule } from '../certificate/certificate.module.js';
import { AnchorModule } from '../anchor/anchor.module.js';
import { IssuanceModule } from '../issuance/issuance.module.js';

@Module({
  imports: [NFTModule, UpdateModule, CertificateModule, AnchorModule, IssuanceModule],
  providers: [SmartMedalService],
  controllers: [],
  exports: [SmartMedalService],
})
export class SmartMedalModule {}

