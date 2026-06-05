import { Module } from '@nestjs/common';
import { VeramoService } from './veramo.service.js';

@Module({
  providers: [VeramoService],
  exports: [VeramoService],
})
export class VeramoModule {}

