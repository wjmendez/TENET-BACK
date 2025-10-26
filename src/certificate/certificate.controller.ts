import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { CertificateService } from './certificate.service.js';
import { IssueBatchDto } from './dto/issue-batch.dto.js';

@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) { }

  @Post('issue-batch')
  @ApiBody({ type: IssueBatchDto })
  issueBatch(@Body() body: IssueBatchDto) {
    return this.certificateService.issueBatch(body.templateId, body.recipients);
  }

  @Get()
  findAll() {
    return this.certificateService.findAll();
  }

  @Get(':id/blockcerts')
  getBlockcertsJson(@Param('id') id: string) {
    return this.certificateService.getBlockcertsJson(id);
  }
}
