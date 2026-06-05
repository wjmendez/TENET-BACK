import { Module } from '@nestjs/common';
import { ControlPlaneTenantsController } from './control-plane-tenants.controller.js';
import { ControlPlaneUsersController } from './control-plane-users.controller.js';
import { ControlPlaneMembershipsController } from './control-plane-memberships.controller.js';
import { ControlPlanePlansController } from './control-plane-plans.controller.js';
import { ControlPlaneTenantsService } from './control-plane-tenants.service.js';
import { ControlPlaneUsersService } from './control-plane-users.service.js';
import { ControlPlanePlansService } from './control-plane-plans.service.js';

@Module({
  controllers: [
    ControlPlaneTenantsController,
    ControlPlaneUsersController,
    ControlPlaneMembershipsController,
    ControlPlanePlansController,
  ],
  providers: [ControlPlaneTenantsService, ControlPlaneUsersService, ControlPlanePlansService],
})
export class ControlPlaneModule {}
