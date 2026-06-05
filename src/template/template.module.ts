import { Module } from '@nestjs/common';
import { TemplateService } from './template.service.js';
import { TemplateController } from './template.controller.js';
import { IssuerModule } from '../issuer/issuer.module.js';

@Module({
  imports: [IssuerModule],
  providers: [TemplateService],
  controllers: [TemplateController],
})
export class TemplateModule {}
