import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { DesignSuggestService } from './design-suggest.service';
import { AskSuggestionDto, ChooseOptionDto, MatchFromPhotoDto } from './dto/design-suggest.dto';
import { AiQuotaService } from '../ai/ai-quota.service';
import { AiKind } from '../ai/schemas/ai-usage.schema';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Goi y thiet ke bang tri tue nhan tao.
 *
 * Moi duong o day deu doi dang nhap, va deu kiem chu so huu tren chinh ban
 * ghi duoc yeu cau chu khong chi kiem nhom quyen.
 */
@Controller('design-suggestions')
export class DesignSuggestController {
  constructor(
    private readonly service: DesignSuggestService,
    private readonly quota: AiQuotaService,
  ) {}

  /** Cac phong cach chon duoc. Dat truoc duong co tham so de khong bi nuot. */
  @Get('styles')
  styles() {
    return { style: this.service.styles() };
  }

  /** Han muc con lai cua nguoi dang dang nhap. */
  @Get('quota')
  quotaLeft(@CurrentUser() user: AuthUser) {
    return this.quota.remaining(user.userId, AiKind.DESIGN_SUGGESTION);
  }

  /** Dung san mot mau gan giong be nhat tu anh cua be, roi mo sang buoc tuy bien. */
  @HttpCode(HttpStatus.CREATED)
  @Post('from-photo')
  fromPhoto(@Body() dto: MatchFromPhotoDto, @CurrentUser() user: AuthUser) {
    return this.service.fromPhoto(user.userId, dto.petId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.listMine(user.userId);
  }

  @Get(':code')
  detail(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.service.findOwned(code, user.userId);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post()
  ask(@Body() dto: AskSuggestionDto, @CurrentUser() user: AuthUser) {
    return this.service.ask(user.userId, dto.petId, dto.style);
  }

  /** Chon mot phuong an va nhan ve ban thiet ke de mo sang buoc tuy bien. */
  @HttpCode(HttpStatus.CREATED)
  @Post(':code/choose')
  choose(
    @Param('code') code: string,
    @Body() dto: ChooseOptionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.choose(user.userId, code, dto.optionKey);
  }
}
