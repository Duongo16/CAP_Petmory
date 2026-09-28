import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CartService } from './cart.service';
import { ChangeQuantityDto, AddToCartDto } from './dto/cart.dto';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('cart')
export class CartController {
  constructor(private readonly service: CartService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.service.get(user.userId);
  }

  @Post('items')
  add(@Body() dto: AddToCartDto, @CurrentUser() user: AuthUser) {
    return this.service.add(user.userId, dto);
  }

  @Patch('items/:id')
  changeQuantity(
    @Param('id') id: string,
    @Body() dto: ChangeQuantityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.changeQuantity(user.userId, id, dto.quantity);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.removeItem(user.userId, id);
  }

  @Delete()
  removeNone(@CurrentUser() user: AuthUser) {
    return this.service.removeNone(user.userId);
  }
}
