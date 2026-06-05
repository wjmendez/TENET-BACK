import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FastifyRequest } from 'fastify';

@Injectable()
export class EmptyBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Si el Content-Type es application/json y el body está vacío, undefined, o es string vacío,
    // establecer body como objeto vacío
    const contentType = request.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      if (
        !request.body ||
        request.body === '' ||
        (typeof request.body === 'string' && request.body.trim() === '') ||
        (typeof request.body === 'object' && Object.keys(request.body || {}).length === 0)
      ) {
        request.body = {};
      }
    }

    return next.handle();
  }
}

