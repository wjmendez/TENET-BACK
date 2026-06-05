import { Module } from '@nestjs/common';
import { AnchorService } from './anchor.service.js';
import { AnchorController } from './anchor.controller.js';

@Module({
  providers: [AnchorService],
  controllers: [AnchorController],
  exports: [AnchorService],
})
export class AnchorModule {}
