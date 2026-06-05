import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithTenant } from './tenant-context.js';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request & { auth?: { tenantId?: string } }, _res: Response, next: NextFunction) {
    const tenantId = req.auth?.tenantId ?? (req as { tenantId?: string }).tenantId;
    if (!tenantId) {
      return next();
    }

    return runWithTenant(tenantId, () => next());
  }
}
