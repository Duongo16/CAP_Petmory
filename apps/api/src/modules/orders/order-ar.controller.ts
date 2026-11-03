import { Controller, Get, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Trang AR mo tu QR in kem don khung thu cung.
 *
 * Khong can dang nhap: QR nam tren mon qua, nguoi nhan co the chua co tai
 * khoan. Ma trong duong dan ngau nhien nen khong do ra duoc don khac.
 */
@Controller('ar')
export class OrderArController {
  constructor(private readonly orders: OrdersService) {}

  @Public()
  @Get(':code')
  view(@Param('code') code: string) {
    return this.orders.arView(code);
  }
}
