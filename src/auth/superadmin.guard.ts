import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth = request?.auth;

    if (!auth?.isSuperadmin) {
      throw new ForbiddenException('Superadmin access required');
    }

    return true;
  }
}
