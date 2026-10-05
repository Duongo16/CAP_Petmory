import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CatalogService, RatingSummary } from './catalog.service';
import { ColorGroup } from './schemas/color-code.schema';
import { ProductTypeDocument } from './schemas/product-type.schema';
import { CreateColorCodeDto, UpdateColorCodeDto } from './dto/color-code.dto';
import { CreateAccessoryDto, UpdateAccessoryDto } from './dto/accessory.dto';
import { AccessoryDocument } from './schemas/accessory.schema';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { INTERNAL, Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../../common/audit.service';

const NO_RATING: RatingSummary = { average: 0, count: 0 };
const RESOURCE_COLOR = 'ColorCode';
const RESOURCE_ACCESSORY = 'Accessory';

class ToggleDto {
  @IsBoolean()
  enabled!: boolean;
}

class ProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  keyword?: string;
}

function isInternal(user?: AuthUser): boolean {
  return user?.roles?.some((role) => INTERNAL.includes(role)) ?? false;
}

@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly service: CatalogService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Get('colors')
  listColor(@CurrentUser() user: AuthUser, @Query('group') group?: ColorGroup) {
    return this.service.listColor(!isInternal(user), group);
  }

  /** The stands offered on the product page. Declared before the parameterised path. */
  @Public()
  @Get('display-bases')
  listDisplayBase(@CurrentUser() user: AuthUser) {
    return this.service.listDisplayBase(!isInternal(user));
  }

  /** Phu kien dung chung. Noi bo thay ca phu kien dang tat. */
  @Public()
  @Get('accessories')
  listAccessory(@CurrentUser() user: AuthUser) {
    return this.service.listAccessory(!isInternal(user));
  }

  @Roles(Role.MANAGER)
  @Post('accessories')
  async createAccessory(@Body() dto: CreateAccessoryDto, @CurrentUser() user: AuthUser) {
    const made = await this.service.createAccessory(dto);
    await this.audit.write({
      actor: user.userId,
      action: 'CREATE_ACCESSORY',
      resourceType: RESOURCE_ACCESSORY,
      resourceId: made.code,
      after: accessoryShort(made),
    });
    return made;
  }

  @Roles(Role.MANAGER)
  @Patch('accessories/:code')
  async updateAccessory(
    @Param('code') code: string,
    @Body() dto: UpdateAccessoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { before, after } = await this.service.updateAccessory(code, dto);
    await this.audit.write({
      actor: user.userId,
      action: 'UPDATE_ACCESSORY',
      resourceType: RESOURCE_ACCESSORY,
      resourceId: after.code,
      before: accessoryShort(before),
      after: accessoryShort(after),
    });
    return after;
  }

  @Public()
  @Get('products')
  async productList(@CurrentUser() user: AuthUser, @Query() query: ProductQueryDto) {
    const list = await this.service.listProductType(!isInternal(user), query.keyword);
    const rating = await this.service.ratingByProduct(list.map((m) => m.code));
    return list.map((m) => this.withRating(m, rating.get(m.code)));
  }

  @Public()
  @Get('products/:code')
  async productDetail(@Param('code') code: string) {
    const kind = await this.service.detailProductType(code);
    const rating = await this.service.ratingByProduct([kind.code]);
    return this.withRating(kind, rating.get(kind.code));
  }

  /** Only the Manager group may add a wool colour to the palette. */
  @Roles(Role.MANAGER)
  @Post('colors')
  async createColor(@Body() dto: CreateColorCodeDto, @CurrentUser() user: AuthUser) {
    const color = await this.service.createColor(dto);
    await this.audit.write({
      actor: user.userId,
      action: 'CREATE_COLOR_CODE',
      resourceType: RESOURCE_COLOR,
      resourceId: color.code,
      after: { displayName: color.displayName, swatch: color.swatch, group: color.group },
    });
    return color;
  }

  @Roles(Role.MANAGER)
  @Patch('colors/:code/edit')
  async updateColor(
    @Param('code') code: string,
    @Body() dto: UpdateColorCodeDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { before, after } = await this.service.updateColor(code, dto);
    await this.audit.write({
      actor: user.userId,
      action: 'UPDATE_COLOR_CODE',
      resourceType: RESOURCE_COLOR,
      resourceId: after.code,
      before: { displayName: before.displayName, swatch: before.swatch, group: before.group },
      after: { displayName: after.displayName, swatch: after.swatch, group: after.group },
    });
    return after;
  }

  @Roles(Role.MANAGER)
  @Patch('colors/:code')
  async toggleColor(
    @Param('code') code: string,
    @Body() dto: ToggleDto,
    @CurrentUser() user: AuthUser,
  ) {
    const color = await this.service.toggleColor(code, dto.enabled);
    await this.audit.write({
      actor: user.userId,
      action: dto.enabled ? 'ENABLE_COLOR_CODE' : 'DISABLE_COLOR_CODE',
      resourceType: RESOURCE_COLOR,
      resourceId: color.code,
      after: { enabled: dto.enabled },
    });
    return color;
  }

  /** Attaches the rolled-up rating without touching the stored record. */
  private withRating(kind: ProductTypeDocument, rating: RatingSummary | undefined) {
    return { ...kind.toObject(), rating: rating ?? NO_RATING };
  }
}

/** Ban thu gon cua phu kien de ghi nhat ky, gia ghi bang chuoi cho chinh xac. */
function accessoryShort(one: Pick<AccessoryDocument, 'displayName' | 'anchor' | 'priceDelta' | 'enabled'>) {
  return { displayName: one.displayName, anchor: one.anchor, priceDelta: String(one.priceDelta), enabled: one.enabled };
}
