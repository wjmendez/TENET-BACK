import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom } from 'rxjs';
import { basePrisma, prisma, runWithPrisma } from './prisma.js';
import { runWithTenant } from '../tenant/tenant-context.js';
import { IS_PUBLIC_KEY } from '../../auth/public.decorator.js';

@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const tenantId = request?.auth?.tenantId ?? request?.tenantId;
    const isSuperadmin = request?.auth?.isSuperadmin;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const rawUrl = request?.raw?.url || request?.url || '';
    const path = rawUrl.split('?')[0] || '';
    const isAuthFlow =
      path === '/auth/login' || path === '/auth/register' || path === '/auth/tenants';

    if (!tenantId && !isPublic) {
      return next.handle();
    }

    return from(
      basePrisma.$transaction(async (tx) =>
        runWithPrisma(tx, async () => {
          if (tenantId) {
            await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
          }
          if (isPublic) {
            await tx.$executeRaw`SELECT set_config('app.public_access', 'true', true)`;
          }
          if (isAuthFlow) {
            await tx.$executeRaw`SELECT set_config('app.auth_access', 'true', true)`;
          }
          if (isSuperadmin) {
            await tx.$executeRaw`SELECT set_config('app.superadmin', 'true', true)`;
          }
          if (tenantId) {
            return runWithTenant(tenantId, () => lastValueFrom(next.handle()));
          }

          return lastValueFrom(next.handle());
        }),
      ),
    );
  }
}
