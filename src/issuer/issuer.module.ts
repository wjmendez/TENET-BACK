import { Module } from '@nestjs/common';
import { IssuerService } from './issuer.service.js';
import { IssuerController } from './issuer.controller.js';
import { VeramoModule } from '../veramo/veramo.module.js';

@Module({
  imports: [VeramoModule],
  providers: [IssuerService],
  controllers: [IssuerController],
  exports: [IssuerService],
})
export class IssuerModule {}

