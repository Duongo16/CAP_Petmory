import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { WebhookGuard } from './webhook.guard';
import { ReconcileDto } from './dto/sepay-notification.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DESK, Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get('qr/:orderCode')
  getQrCode(@Param('orderCode') orderCode: string, @CurrentUser() user: AuthUser) {
    return this.service.getQrCode(orderCode, user.userId);
  }

  /**
   * Webhook cua SePay.
   *
   * Khong dung tai khoan nguoi dung ma dung khoa bi mat trong tieu de. Than
   * giao dich nhan dang doi tuong tho de bo kiem chung khong tu choi truong la;
   * phan kiem nam trong dich vu. Bo qua gioi han so lan goi, vi SePay goi lai
   * moi giao dich that va mot lan bi chan la mot lan tien ve tre.
   */
  @Public()
  @SkipThrottle()
  @UseGuards(WebhookGuard)
  @HttpCode(HttpStatus.OK)
  @Post('webhook')
  receiveNotification(@Body() message: Record<string, unknown>) {
    return this.service.receiveNotification(message ?? {});
  }

  /** Doi soat voi SePay, lay giao dich webhook da bo lo. Chi nhom Quan ly. */
  @Roles(Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  @Post('reconcile')
  reconcile(@Body() dto: ReconcileDto, @CurrentUser() user: AuthUser) {
    return this.service.reconcile(dto.days, user.userId);
  }

  @Roles(...DESK)
  @Get('log')
  log(@Query('limit') limit?: string) {
    return this.service.listLog(Number(limit ?? 50));
  }
}
