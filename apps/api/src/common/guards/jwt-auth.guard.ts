import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../constants/roles';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.isPublic(context)) {
      return (await super.canActivate(context)) as boolean;
    }
    /*
     * An open endpoint still reads the session when one is sent, so a page can
     * show the viewer their own hearts and saved items. A missing or expired
     * token simply leaves the request as a guest instead of failing it.
     */
    try {
      await super.canActivate(context);
    } catch {
      return true;
    }
    return true;
  }

  handleRequest<TUser>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    if (this.isPublic(context)) {
      return (user ?? null) as TUser;
    }
    return super.handleRequest(err, user, info, context, status) as TUser;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }
}
