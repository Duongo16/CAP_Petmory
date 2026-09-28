import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentsService, SePayNotification } from './payments.service';
import { WebhookGuard } from './webhook.guard';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get('qr/:orderCode')
  getQrCode(@Param('orderCode') orderCode: string, @CurrentUser() user: AuthUser) {
    return this.service.getQrCode(orderCode, user.userId);
  }

  /**
   * Endpoint that receives notifications from the transfer confirmation service.
   * It uses no user authentication; a shared secret in the request header instead.
   */
  @Public()
  @UseGuards(WebhookGuard)
  @HttpCode(HttpStatus.OK)
  @Post('webhook')
  receiveNotification(@Body() message: SePayNotification) {
    return this.service.receiveNotification(message);
  }

  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPPORT)
  @Get('log')
  log(@Query('limit') limit?: string) {
    return this.service.listLog(Number(limit ?? 50));
  }
}
