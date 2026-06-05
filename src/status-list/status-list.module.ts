import { Module } from '@nestjs/common';
import { StatusListService } from './status-list.service.js';
import { StatusListController } from './status-list.controller.js';

@Module({
  controllers: [StatusListController],
  providers: [StatusListService],
  exports: [StatusListService],
})
export class StatusListModule {}
