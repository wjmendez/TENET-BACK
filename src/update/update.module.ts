import { Module } from '@nestjs/common';
import { UpdateService } from './update.service.js';
import { NFTModule } from '../nft/nft.module.js';

@Module({
  imports: [NFTModule],
  providers: [UpdateService],
  exports: [UpdateService],
})
export class UpdateModule {}

