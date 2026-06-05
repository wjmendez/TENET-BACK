import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OwnerOrSuperadminGuard } from '../auth/owner-or-superadmin.guard.js';
import { SuperadminGuard } from '../auth/superadmin.guard.js';
import { ControlPlanePlansService } from './control-plane-plans.service.js';

@ApiTags('Control Plane - Plans')
@Controller('control-plane/plans')
@UseGuards(OwnerOrSuperadminGuard)
export class ControlPlanePlansController {
  constructor(private readonly plansService: ControlPlanePlansService) {}

  @Get()
  @ApiOperation({ summary: 'Listar planes' })
  @ApiResponse({ status: 200, description: 'Lista de planes' })
  async listPlans() {
    return this.plansService.listPlans();
  }

  @Post()
  @UseGuards(SuperadminGuard)
  @ApiOperation({ summary: 'Crear plan (superadmin)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code', 'monthlyIssuanceQuota', 'monthlyApiCallsQuota', 'rateLimitRps'],
      properties: {
        code: { type: 'string' },
        monthlyIssuanceQuota: { type: 'number' },
        monthlyApiCallsQuota: { type: 'number' },
        rateLimitRps: { type: 'number' },
        features: { type: 'object' },
      },
    },
  })
  async createPlan(@Body() body: any) {
    return this.plansService.createPlan(body);
  }

  @Patch(':id')
  @UseGuards(SuperadminGuard)
  @ApiOperation({ summary: 'Actualizar plan (superadmin)' })
  @ApiParam({ name: 'id' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        monthlyIssuanceQuota: { type: 'number' },
        monthlyApiCallsQuota: { type: 'number' },
        rateLimitRps: { type: 'number' },
        features: { type: 'object' },
        isActive: { type: 'boolean' },
      },
    },
  })
  async updatePlan(@Param('id') id: string, @Body() body: any) {
    return this.plansService.updatePlan(id, body);
  }
}
