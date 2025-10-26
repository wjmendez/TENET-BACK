
import { Module } from '@nestjs/common';
import { TemplateModule } from './template/template.module.js';
import { CertificateModule } from './certificate/certificate.module.js';
import { AnchorModule } from './anchor/anchor.module.js';
import { BlockcertsModule } from './blockcerts/blockcerts.module.js';
import { AppService } from './app.service.js';
import { AppController } from './app.controller.js';
import { EventController } from './event.controller.js';


@Module({
  imports: [TemplateModule, CertificateModule, AnchorModule, BlockcertsModule],
  controllers: [AppController, EventController],
  providers: [AppService],
})
export class AppModule {}
