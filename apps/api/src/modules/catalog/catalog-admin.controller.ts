import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CatalogAdminService } from './catalog-admin.service';
import {
  CreateDisplayBaseDto,
  CreatePackagingDto,
  CreateProductSizeDto,
  CreateProductTypeDto,
  UpdateDisplayBaseDto,
  UpdatePackagingDto,
  UpdateProductSizeDto,
  UpdateProductTypeDto,
} from './dto/catalog-admin.dto';
import { PackagingKind } from './schemas/packaging-option.schema';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { INTERNAL, Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/audit.service';

const RESOURCE_PRODUCT = 'ProductType';
const RESOURCE_BASE = 'DisplayBase';
const RESOURCE_PACKAGING = 'PackagingOption';

function isInternal(user?: AuthUser): boolean {
  return user?.roles?.some((role) => INTERNAL.includes(role)) ?? false;
}

/** Ban thu gon de ghi nhat ky: chuyen so thap phan sang chuoi, bo truong noi bo. */
function short(raw: unknown): Record<string, unknown> {
  const source = (raw && typeof raw === 'object' && 'toObject' in raw
    ? (raw as { toObject: () => Record<string, unknown> }).toObject()
    : (raw as Record<string, unknown>)) ?? {};
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(source)) {
    if (['_id', '__v', 'createdAt', 'updatedAt', 'sizes'].includes(name)) {
      continue;
    }
    out[name] = value && typeof value === 'object' && 'toString' in value && !Array.isArray(value)
      ? String(value)
      : value;
  }
  return out;
}

/**
 * Quan tri danh muc san pham va vat lieu (muc 12, 13).
 *
 * Chi nhom Quan ly sua duoc. Moi thay doi ghi nhat ky kem truoc va sau, vi gia
 * va thong so o day quyet dinh tien cua cac don sau nay.
 */
@Controller('catalog')
export class CatalogAdminController {
  constructor(
    private readonly service: CatalogAdminService,
    private readonly audit: AuditService,
  ) {}

  @Roles(Role.MANAGER)
  @Post('products')
  async createProductType(@Body() dto: CreateProductTypeDto, @CurrentUser() user: AuthUser) {
    const made = await this.service.createProductType(dto);
    await this.write(user, 'CREATE_PRODUCT_TYPE', RESOURCE_PRODUCT, made.code, undefined, short(made));
    return made;
  }

  @Roles(Role.MANAGER)
  @Patch('products/:code')
  async updateProductType(@Param('code') code: string, @Body() dto: UpdateProductTypeDto, @CurrentUser() user: AuthUser) {
    const { before, after } = await this.service.updateProductType(code, dto);
    await this.write(user, 'UPDATE_PRODUCT_TYPE', RESOURCE_PRODUCT, after.code, short(before), short(after));
    return after;
  }

  @Roles(Role.MANAGER)
  @Post('products/:code/sizes')
  async addSize(@Param('code') code: string, @Body() dto: CreateProductSizeDto, @CurrentUser() user: AuthUser) {
    const parent = await this.service.addSize(code, dto);
    const size = parent.sizes.find((one) => one.code === dto.code.toUpperCase());
    await this.write(user, 'CREATE_PRODUCT_SIZE', RESOURCE_PRODUCT, `${parent.code}/${size?.code}`, undefined, short(size));
    return parent;
  }

  @Roles(Role.MANAGER)
  @Patch('products/:code/sizes/:size')
  async updateSize(
    @Param('code') code: string,
    @Param('size') sizeCode: string,
    @Body() dto: UpdateProductSizeDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { before, after, parent } = await this.service.updateSize(code, sizeCode, dto);
    await this.write(user, 'UPDATE_PRODUCT_SIZE', RESOURCE_PRODUCT, `${parent.code}/${after.code}`, short(before), short(after));
    return parent;
  }

  @Roles(Role.MANAGER)
  @Post('display-bases')
  async createDisplayBase(@Body() dto: CreateDisplayBaseDto, @CurrentUser() user: AuthUser) {
    const made = await this.service.createDisplayBase(dto);
    await this.write(user, 'CREATE_DISPLAY_BASE', RESOURCE_BASE, made.code, undefined, short(made));
    return made;
  }

  @Roles(Role.MANAGER)
  @Patch('display-bases/:code')
  async updateDisplayBase(@Param('code') code: string, @Body() dto: UpdateDisplayBaseDto, @CurrentUser() user: AuthUser) {
    const { before, after } = await this.service.updateDisplayBase(code, dto);
    await this.write(user, 'UPDATE_DISPLAY_BASE', RESOURCE_BASE, after.code, short(before), short(after));
    return after;
  }

  /** Hop va khung. Khach chi thay mau dang ban; noi bo thay ca mau dang tat. */
  @Public()
  @Get('packaging')
  listPackaging(@CurrentUser() user: AuthUser, @Query('kind') kind?: PackagingKind) {
    return this.service.listPackaging(!isInternal(user), kind);
  }

  @Roles(Role.MANAGER)
  @Post('packaging')
  async createPackaging(@Body() dto: CreatePackagingDto, @CurrentUser() user: AuthUser) {
    const made = await this.service.createPackaging(dto);
    await this.write(user, 'CREATE_PACKAGING', RESOURCE_PACKAGING, made.code, undefined, short(made));
    return made;
  }

  @Roles(Role.MANAGER)
  @Patch('packaging/:code')
  async updatePackaging(@Param('code') code: string, @Body() dto: UpdatePackagingDto, @CurrentUser() user: AuthUser) {
    const { before, after } = await this.service.updatePackaging(code, dto);
    await this.write(user, 'UPDATE_PACKAGING', RESOURCE_PACKAGING, after.code, short(before), short(after));
    return after;
  }

  private write(
    user: AuthUser,
    action: string,
    resourceType: string,
    resourceId: string,
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown>,
  ) {
    return this.audit.write({ actor: user.userId, action, resourceType, resourceId, before, after });
  }
}
