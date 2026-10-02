import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/order.dto';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.listMine(user.userId);
  }

  @Get(':orderCode')
  detail(@Param('orderCode') orderCode: string, @CurrentUser() user: AuthUser) {
    return this.service.findOwned(orderCode, user.userId);
  }

  /** Khach tu huy mot don con dang cho thanh toan. */
  @Post(':orderCode/cancel')
  cancel(@Param('orderCode') orderCode: string, @CurrentUser() user: AuthUser) {
    return this.service.cancelMine(orderCode, user.userId);
  }

  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) {
    return this.service.createFromCart(user.userId, dto);
  }
}
