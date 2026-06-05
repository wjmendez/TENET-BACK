import { Module } from '@nestjs/common';
import { BlockcertsController } from './blockcerts.controller.js';
import { IssuerModule } from '../issuer/issuer.module.js';

@Module({
  imports: [IssuerModule],
  controllers: [BlockcertsController],
})
export class BlockcertsModule {}







