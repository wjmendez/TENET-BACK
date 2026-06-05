import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, mergeMap } from 'rxjs';
import { IS_PUBLIC_KEY } from '../../auth/public.decorator.js';
import { QuotaService } from './quota.service.js';

@Injectable()
export class QuotaInterceptor implements NestInterceptor {
  constructor(
    private readonly quotaService: QuotaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request?.method || '';

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const auth = request?.auth;
    if (isPublic || method === 'OPTIONS' || !auth?.tenantId) {
      return next.handle();
    }

    return from(this.quotaService.assertApiQuota(auth.tenantId)).pipe(
      mergeMap(() => next.handle()),
    );
  }
}
