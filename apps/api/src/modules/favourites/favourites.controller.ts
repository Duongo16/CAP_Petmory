import { Controller, Get, Param, Post } from '@nestjs/common';
import { FavouritesService } from './favourites.service';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('favourites')
export class FavouritesController {
  constructor(private readonly service: FavouritesService) {}

  /** Just the codes, used to paint the hearts on a product list. */
  @Get('codes')
  codes(@CurrentUser() user: AuthUser) {
    return this.service.codesOf(user.userId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.listOf(user.userId);
  }

  @Post(':code/toggle')
  toggle(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.service.toggle(user.userId, code);
  }
}
