import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';

/** Bam khoa ra cung mot do dai, de so sanh khong de lo do dai hay tung ky tu qua thoi gian. */
function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Xac thuc webhook SePay bang khoa bi mat trong tieu de "Authorization: Apikey <khoa>".
 *
 * Mot giao dich khong bao gio duoc tin chi vi dung hinh dang. Thieu khoa trong
 * cau hinh thi tu choi tat ca, khong co khoa mac dinh. Neu da khai danh sach
 * IP cua SePay thi yeu cau phai den tu dung cac IP do.
 */
@Injectable()
export class WebhookGuard implements CanActivate {
  private readonly logger = new Logger(WebhookGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expectedKey = this.config.get<string>('sepayWebhookKey') ?? '';
    if (!expectedKey) {
      this.logger.error('Chua cau hinh SEPAY_WEBHOOK_KEY, webhook tu choi moi yeu cau');
      throw new UnauthorizedException();
    }

    const allowed = this.config.get<string[]>('sepay.allowedIps') ?? [];
    const from = (req.ip ?? '').replace(/^::ffff:/, '');
    if (allowed.length > 0 && !allowed.includes(from)) {
      this.logger.warn(`Webhook bi chan tu IP ${from}`);
      throw new UnauthorizedException();
    }

    const header = req.headers.authorization ?? '';
    const sentKey = header.replace(/^Apikey\s+/i, '').trim();
    if (!timingSafeEqual(digest(sentKey), digest(expectedKey))) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
