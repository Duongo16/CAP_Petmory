import { Controller, Get, Param } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

/** Thanh toan chuyen khoan thu cong bang anh QR tinh. */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get('qr/:orderCode')
  getQrCode(@Param('orderCode') orderCode: string, @CurrentUser() user: AuthUser) {
    return this.service.getQrCode(orderCode, user.userId);
  }
}
