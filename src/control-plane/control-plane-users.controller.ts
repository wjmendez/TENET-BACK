import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { OwnerOrSuperadminGuard } from '../auth/owner-or-superadmin.guard.js';
import { ControlPlaneUsersService } from './control-plane-users.service.js';

@ApiTags('Control Plane - Users')
@Controller('control-plane/users')
@UseGuards(OwnerOrSuperadminGuard)
export class ControlPlaneUsersController {
  constructor(private readonly usersService: ControlPlaneUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuarios del tenant' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiResponse({ status: 200, description: 'Lista de usuarios' })
  async listUsers(@Req() req: FastifyRequest, @Query('tenantId') tenantId?: string) {
    const auth = req.auth!;
    const resolvedTenantId = auth.isSuperadmin && tenantId ? tenantId : auth.tenantId;
    return this.usersService.listUsers(resolvedTenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear usuario y membership' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string' },
        password: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string', example: 'ADMIN' },
        tenantId: { type: 'string' },
      },
    },
  })
  async createUser(@Req() req: FastifyRequest, @Body() body: any) {
    const auth = req.auth!;
    const resolvedTenantId = auth.isSuperadmin && body.tenantId ? body.tenantId : auth.tenantId;
    return this.usersService.createUser(resolvedTenantId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar usuario' })
  @ApiParam({ name: 'id' })
  async updateUser(
    @Param('id') id: string,
    @Body() body: { name?: string; status?: 'ACTIVE' | 'BLOCKED' },
    @Req() req: FastifyRequest,
  ) {
    const auth = req.auth!;
    return this.usersService.updateUser(id, auth.tenantId, body, auth.isSuperadmin);
  }
}
