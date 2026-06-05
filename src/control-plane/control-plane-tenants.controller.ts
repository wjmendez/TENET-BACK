import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { OwnerOrSuperadminGuard } from '../auth/owner-or-superadmin.guard.js';
import { SuperadminGuard } from '../auth/superadmin.guard.js';
import { ControlPlaneTenantsService } from './control-plane-tenants.service.js';

@ApiTags('Control Plane - Tenants')
@Controller('control-plane/tenants')
@UseGuards(OwnerOrSuperadminGuard)
export class ControlPlaneTenantsController {
  constructor(private readonly tenantsService: ControlPlaneTenantsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tenants' })
  @ApiResponse({ status: 200, description: 'Lista de tenants' })
  async listTenants(@Req() req: FastifyRequest) {
    const auth = req.auth!;
    return this.tenantsService.listTenants(auth);
  }

  @Get(':tenantId')
  @ApiOperation({ summary: 'Obtener tenant por ID' })
  @ApiParam({ name: 'tenantId' })
  async getTenant(@Param('tenantId') tenantId: string, @Req() req: FastifyRequest) {
    return this.tenantsService.getTenant(tenantId, req.auth!);
  }

  @Post()
  @UseGuards(SuperadminGuard)
  @ApiOperation({ summary: 'Crear tenant (superadmin)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        slug: { type: 'string' },
        status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'DELETED'] },
        planCode: { type: 'string', example: 'FREE' },
        branding: { type: 'object' },
      },
    },
  })
  async createTenant(@Body() body: any) {
    return this.tenantsService.createTenant(body);
  }

  @Patch(':tenantId')
  @ApiOperation({ summary: 'Actualizar tenant' })
  @ApiParam({ name: 'tenantId' })
  async updateTenant(
    @Param('tenantId') tenantId: string,
    @Body() body: { name?: string; status?: 'ACTIVE' | 'SUSPENDED' | 'DELETED' },
    @Req() req: FastifyRequest,
  ) {
    return this.tenantsService.updateTenant(tenantId, body, req.auth!);
  }

  @Put(':tenantId/branding')
  @ApiOperation({ summary: 'Actualizar branding de tenant' })
  @ApiParam({ name: 'tenantId' })
  async updateBranding(
    @Param('tenantId') tenantId: string,
    @Body() body: any,
    @Req() req: FastifyRequest,
  ) {
    return this.tenantsService.updateBranding(tenantId, body, req.auth!);
  }

  @Delete(':tenantId')
  @UseGuards(SuperadminGuard)
  @ApiOperation({ summary: 'Eliminar tenant (soft delete)' })
  @ApiParam({ name: 'tenantId' })
  async deleteTenant(@Param('tenantId') tenantId: string) {
    return this.tenantsService.deleteTenant(tenantId);
  }

  @Get(':tenantId/plan')
  @ApiOperation({ summary: 'Obtener plan activo del tenant' })
  @ApiParam({ name: 'tenantId' })
  async getTenantPlan(@Param('tenantId') tenantId: string, @Req() req: FastifyRequest) {
    return this.tenantsService.getTenantPlan(tenantId, req.auth!);
  }

  @Post(':tenantId/plan')
  @UseGuards(SuperadminGuard)
  @ApiOperation({ summary: 'Asignar plan al tenant (superadmin)' })
  @ApiParam({ name: 'tenantId' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['planCode'],
      properties: {
        planCode: { type: 'string', example: 'PRO' },
        months: { type: 'number', example: 1 },
      },
    },
  })
  async assignPlan(
    @Param('tenantId') tenantId: string,
    @Body() body: { planCode: string; months?: number },
    @Req() req: FastifyRequest,
  ) {
    return this.tenantsService.assignPlan(tenantId, body, req.auth!);
  }
}
