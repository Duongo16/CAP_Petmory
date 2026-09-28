import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Authenticates a transfer notification with the shared secret in the request header.
 * A notification is never trusted merely because its shape looks right.
 */
@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expectedKey = this.config.get<string>('sepayWebhookKey');
    if (!expectedKey) {
      throw new UnauthorizedException();
    }
    const title = req.headers.authorization ?? '';
    const sentKey = title.replace(/^Apikey\s+/i, '').trim();
    if (sentKey !== expectedKey) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
