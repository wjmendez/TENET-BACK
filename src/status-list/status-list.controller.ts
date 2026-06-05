import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator.js';
import { StatusListService } from './status-list.service.js';
import type { FastifyReply } from 'fastify';

@ApiTags('Status List')
@Controller('.well-known/status')
@Public()
export class StatusListController {
  constructor(private readonly statusListService: StatusListService) {}

  @Get(':statusListId')
  @ApiOperation({ summary: 'Status List 2021 credential' })
  @ApiParam({ name: 'statusListId' })
  @ApiResponse({ status: 200, description: 'Status list credential' })
  async getStatusList(@Param('statusListId') statusListId: string, @Res() reply: FastifyReply) {
    const credential = await this.statusListService.getStatusListCredential(statusListId);
    reply.header('Cache-Control', 'public, max-age=300');
    return reply.send(credential);
  }
}
