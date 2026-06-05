import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, mergeMap } from 'rxjs';
import { IS_PUBLIC_KEY } from '../../auth/public.decorator.js';
import { RateLimitService } from './rate-limit.service.js';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const reply = context.switchToHttp().getResponse();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const auth = request?.auth;
    const limit = auth?.rateLimitRps;

    if (!limit || isPublic) {
      return next.handle();
    }

    const windowSeconds = 1;
    const key = auth.authType === 'apiKey'
      ? `rl:tenant:${auth.tenantId}:api:${auth.apiKeyId}`
      : `rl:tenant:${auth.tenantId}`;

    return from(this.rateLimitService.consume(key, limit, windowSeconds)).pipe(
      mergeMap((result) => {
        if (reply?.header) {
          reply.header('X-RateLimit-Limit', result.limit);
          reply.header('X-RateLimit-Remaining', result.remaining);
          reply.header('X-RateLimit-Reset', result.reset);
        }

        if (!result.allowed) {
          throw new HttpException('Rate limit exceeded', 429);
        }

        return next.handle();
      }),
    );
  }
}
