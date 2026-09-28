import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, ROLES_KEY } from '../constants/roles';
import { MSG } from '../constants/messages';
import { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    const allowed = user?.roles?.some((role) => required.includes(role)) ?? false;
    if (!allowed) {
      throw new ForbiddenException(MSG.FORBIDDEN);
    }
    return true;
  }
}
