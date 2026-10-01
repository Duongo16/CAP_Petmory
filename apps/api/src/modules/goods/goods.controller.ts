import { Controller, Get, Param, Query } from '@nestjs/common';
import { GoodsService } from './goods.service';
import { GoodsQueryDto } from './dto/goods.dto';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Danh muc hang co san cho khach xem.
 *
 * Doc duoc khi chua dang nhap, giong danh muc hang tuy bien: khach phai xem
 * duoc hang truoc khi quyet dinh mo tai khoan.
 */
@Controller('goods')
export class GoodsController {
  constructor(private readonly service: GoodsService) {}

  /** Cac nhom hang. Dat truoc duong co tham so de chu categories khong bi nuot. */
  @Public()
  @Get('categories')
  categories() {
    return this.service.listCategory();
  }

  @Public()
  @Get()
  list(@Query() query: GoodsQueryDto) {
    return this.service.list(query);
  }

  @Public()
  @Get(':code')
  detail(@Param('code') code: string) {
    return this.service.detail(code);
  }
}
