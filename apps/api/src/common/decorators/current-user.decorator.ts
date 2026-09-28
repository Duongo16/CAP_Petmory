import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../constants/roles';

export interface AuthUser {
  userId: string;
  email: string;
  roles: Role[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
