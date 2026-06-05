import { Module } from '@nestjs/common';
import { CredentialTypeService } from './credential-type.service.js';
import { CredentialTypeController } from './credential-type.controller.js';

@Module({
  providers: [CredentialTypeService],
  controllers: [CredentialTypeController],
  exports: [CredentialTypeService],
})
export class CredentialTypeModule {}

