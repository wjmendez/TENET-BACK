import { Module } from '@nestjs/common';
import { TemplateService } from './template.service.js';
import { TemplateController } from './template.controller.js';



@Module({
  providers: [TemplateService],
  controllers: [TemplateController],
})
export class TemplateModule {}
