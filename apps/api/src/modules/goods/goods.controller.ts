import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GoodsService } from './goods.service';
import { GoodsImageService } from './goods-image.service';
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
  constructor(
    private readonly service: GoodsService,
    private readonly images: GoodsImageService,
  ) {}

  /** Cac nhom hang. Dat truoc duong co tham so de chu categories khong bi nuot. */
  @Public()
  @Get('categories')
  categories() {
    return this.service.listCategory();
  }

  /**
   * Anh san pham quan ly da tai len kho tren dia.
   *
   * Trang web chay o cong khac, ma mac dinh chi cho doc cung nguon, nen phai
   * mo cho the anh cua trang khac doc duoc. Ten tep la ma ngau nhien va khong
   * doi, nen cho luu lau.
   */
  @Public()
  @Get('images/:fileName')
  async image(@Param('fileName') fileName: string, @Res() res: Response) {
    const { data, type } = await this.images.read(fileName);
    res.setHeader('Content-Type', type);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.send(data);
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
