import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { GoodsService } from './goods.service';
import { GoodsAdminService } from './goods-admin.service';
import { GOODS_IMAGE_MAX_BYTES, GoodsImageService } from './goods-image.service';
import {
  CreateGoodsDto,
  GoodsCategoryDto,
  GoodsQueryDto,
  StockAdjustDto,
  UpdateGoodsCategoryDto,
  UpdateGoodsDto,
} from './dto/goods.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/audit.service';

const RESOURCE_GOODS = 'Goods';
const RESOURCE_CATEGORY = 'GoodsCategory';

/**
 * Quan ly hang co san.
 *
 * Ca ba nhom noi bo deu doc duoc, nhung chi Quan ly va Quan tri vien sua
 * duoc: gia va ton kho la tien va la hang that, khong phai thu de mo cho ca
 * nha cung sua.
 */
@Controller('admin/goods')
export class GoodsAdminController {
  constructor(
    private readonly service: GoodsService,
    private readonly manage: GoodsAdminService,
    private readonly audit: AuditService,
    private readonly images: GoodsImageService,
  ) {}

  /**
   * Tai mot anh san pham tu may len.
   *
   * Tra ve dia chi de dat vao danh sach anh cua mon hang; mon hang chi giu anh
   * khi quan ly bam luu. Kho tren dia khong co dia chi rieng nen API tu tra tep
   * qua duong cong khai cua trang khach.
   */
  @Roles(Role.MANAGER)
  @Post('images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: GOODS_IMAGE_MAX_BYTES } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    const fileName = await this.images.save(file);
    return { url: this.images.addressOf(fileName) ?? `${originOf(req)}/api/goods/images/${fileName}` };
  }

  @Roles(Role.MANAGER)
  @Get('categories')
  categories() {
    return this.service.listCategory(true);
  }

  @Roles(Role.MANAGER)
  @Post('categories')
  async makeCategory(@Body() dto: GoodsCategoryDto, @CurrentUser() user: AuthUser) {
    const made = await this.manage.createCategory(dto);
    await this.audit.write({
      actor: user.userId,
      action: 'GOODS_CATEGORY_CREATED',
      resourceType: RESOURCE_CATEGORY,
      resourceId: made.code,
      after: { name: made.name, enabled: made.enabled },
    });
    return made;
  }

  @Roles(Role.MANAGER)
  @Patch('categories/:code')
  async changeCategory(
    @Param('code') code: string,
    @Body() dto: UpdateGoodsCategoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const after = await this.manage.updateCategory(code, dto);
    await this.audit.write({
      actor: user.userId,
      action: 'GOODS_CATEGORY_UPDATED',
      resourceType: RESOURCE_CATEGORY,
      resourceId: after.code,
      after: { name: after.name, enabled: after.enabled },
    });
    return after;
  }

  @Roles(Role.MANAGER)
  @Delete('categories/:code')
  async dropCategory(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    const after = await this.manage.hideCategory(code);
    await this.audit.write({
      actor: user.userId,
      action: 'GOODS_CATEGORY_HIDDEN',
      resourceType: RESOURCE_CATEGORY,
      resourceId: after.code,
    });
    return after;
  }

  @Roles(Role.MANAGER)
  @Get()
  list(@Query() query: GoodsQueryDto) {
    return this.service.list(query, true);
  }

  @Roles(Role.MANAGER)
  @Get(':code')
  detail(@Param('code') code: string) {
    return this.service.detail(code, true);
  }

  /** Lich su thay doi ton kho cua mot to hop. */
  @Roles(Role.MANAGER)
  @Get(':code/stock/:sku')
  moves(@Param('code') code: string, @Param('sku') sku: string) {
    return this.service.movesOf(code, sku);
  }

  @Roles(Role.MANAGER)
  @Post()
  async make(@Body() dto: CreateGoodsDto, @CurrentUser() user: AuthUser) {
    const made = await this.manage.createGoods(dto, user.userId);
    await this.audit.write({
      actor: user.userId,
      action: 'GOODS_CREATED',
      resourceType: RESOURCE_GOODS,
      resourceId: made.code,
      after: shortOf(made),
    });
    return made;
  }

  /**
   * Sua mot mon hang.
   *
   * Nhat ky ghi ca gia truoc va gia sau, vi mot lan doi gia co the lam lech
   * moi con so doanh thu neu khong ai biet no da doi luc nao.
   */
  @Roles(Role.MANAGER)
  @Patch(':code')
  async change(
    @Param('code') code: string,
    @Body() dto: UpdateGoodsDto,
    @CurrentUser() user: AuthUser,
  ) {
    const before = await this.service.detail(code, true);
    const after = await this.manage.updateGoods(code, dto, user.userId);
    await this.audit.write({
      actor: user.userId,
      action: 'GOODS_UPDATED',
      resourceType: RESOURCE_GOODS,
      resourceId: after.code,
      before: shortOf(before),
      after: shortOf(after),
    });
    return after;
  }

  @Roles(Role.MANAGER)
  @Delete(':code')
  async drop(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    const after = await this.manage.hideGoods(code);
    await this.audit.write({
      actor: user.userId,
      action: 'GOODS_HIDDEN',
      resourceType: RESOURCE_GOODS,
      resourceId: after.code,
    });
    return after;
  }

  /** Nhap hoac dieu chinh ton kho bang tay, kem ly do bat buoc. */
  @Roles(Role.MANAGER)
  @Patch(':code/stock/:sku')
  async adjust(
    @Param('code') code: string,
    @Param('sku') sku: string,
    @Body() dto: StockAdjustDto,
    @CurrentUser() user: AuthUser,
  ) {
    const after = await this.service.adjustStock(code, sku, dto.delta, dto.note, user.userId);
    await this.audit.write({
      actor: user.userId,
      action: 'GOODS_STOCK_ADJUSTED',
      resourceType: RESOURCE_GOODS,
      resourceId: `${after.code}/${sku.toUpperCase()}`,
      reason: dto.note,
      after: { delta: dto.delta },
    });
    return after;
  }
}

/** Ban thu gon cua mot mon hang de ghi vao nhat ky he thong. */
function shortOf(one: { code: string; name: string; enabled: boolean; variant: { sku: string; price: unknown; stock: number }[] }) {
  return {
    code: one.code,
    name: one.name,
    enabled: one.enabled,
    variant: one.variant.map((each) => ({
      sku: each.sku,
      price: String(each.price),
      stock: each.stock,
    })),
  };
}

/**
 * Goc dia chi ma trinh duyet dung de goi API.
 *
 * Sau lop chuyen tiep (Vercel) thi dia chi that nam o hai dau X-Forwarded,
 * con chay tren may thi lay thang tu yeu cau.
 */
function originOf(req: Request): string {
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.split(',')[0].trim();
  const proto = first(req.headers['x-forwarded-proto']) || req.protocol;
  const host = first(req.headers['x-forwarded-host']) || req.get('host');
  return `${proto}://${host}`;
}
