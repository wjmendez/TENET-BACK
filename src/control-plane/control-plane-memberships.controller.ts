import { Body, Controller, Delete, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { OwnerOrSuperadminGuard } from '../auth/owner-or-superadmin.guard.js';
import { ControlPlaneUsersService } from './control-plane-users.service.js';

@ApiTags('Control Plane - Memberships')
@Controller('control-plane/memberships')
@UseGuards(OwnerOrSuperadminGuard)
export class ControlPlaneMembershipsController {
  constructor(private readonly usersService: ControlPlaneUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar memberships del tenant' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiResponse({ status: 200, description: 'Lista de memberships' })
  async listMemberships(@Req() req: FastifyRequest, @Query('tenantId') tenantId?: string) {
    const auth = req.auth!;
    const resolvedTenantId = auth.isSuperadmin && tenantId ? tenantId : auth.tenantId;
    return this.usersService.listMemberships(resolvedTenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar role de membership' })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['role'],
      properties: {
        role: { type: 'string', example: 'ADMIN' },
      },
    },
  })
  async updateMembership(
    @Param('id') id: string,
    @Body() body: { role: string },
    @Req() req: FastifyRequest,
  ) {
    const auth = req.auth!;
    return this.usersService.updateMembershipRole(id, auth.tenantId, body.role, auth.isSuperadmin);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar membership' })
  @ApiParam({ name: 'id' })
  async deleteMembership(@Param('id') id: string, @Req() req: FastifyRequest) {
    const auth = req.auth!;
    return this.usersService.deleteMembership(id, auth.tenantId, auth.isSuperadmin);
  }
}
