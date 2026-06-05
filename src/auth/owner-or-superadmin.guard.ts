import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class OwnerOrSuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth = request?.auth;

    if (!auth) {
      throw new ForbiddenException('Not authenticated');
    }

    if (auth.isSuperadmin || auth.role === 'OWNER') {
      return true;
    }

    throw new ForbiddenException('Insufficient role');
  }
}
