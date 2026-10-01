import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PetStoryService } from './pet-story.service';
import {
  AttachStoryDto,
  EditStoryDto,
  RewriteStoryDto,
  WriteStoryDto,
} from './dto/pet-story.dto';
import { AiQuotaService } from '../ai/ai-quota.service';
import { AiKind } from '../ai/schemas/ai-usage.schema';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Cau chuyen ve thu cung, viet bang tri tue nhan tao.
 *
 * Moi duong deu doi dang nhap, va deu kiem chu so huu tren chinh ban ghi duoc
 * yeu cau chu khong chi kiem nhom quyen.
 */
@Controller('pet-stories')
export class PetStoryController {
  constructor(
    private readonly service: PetStoryService,
    private readonly quota: AiQuotaService,
  ) {}

  /** Cac giong van chon duoc. Dat truoc duong co tham so de khong bi nuot. */
  @Get('tones')
  tones() {
    return { tone: this.service.tones() };
  }

  @Get('quota')
  quotaLeft(@CurrentUser() user: AuthUser) {
    return this.quota.remaining(user.userId, AiKind.STORY_WRITING);
  }

  @Get()
  list(@Query('petId') petId: string, @CurrentUser() user: AuthUser) {
    return this.service.listByPet(petId ?? '', user.userId);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOwned(id, user.userId);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post()
  write(@Body() dto: WriteStoryDto, @CurrentUser() user: AuthUser) {
    return this.service.write(user.userId, dto.petId, dto.tone, dto.notes ?? '');
  }

  @HttpCode(HttpStatus.CREATED)
  @Post(':id/rewrite')
  rewrite(
    @Param('id') id: string,
    @Body() dto: RewriteStoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.rewrite(user.userId, id, dto.notes ?? '');
  }

  @Patch(':id')
  edit(@Param('id') id: string, @Body() dto: EditStoryDto, @CurrentUser() user: AuthUser) {
    return this.service.edit(user.userId, id, dto.title, dto.content);
  }

  /** Gan ban nay vao mot khoanh khac trong nhat ky. */
  @Post(':id/attach')
  attach(
    @Param('id') id: string,
    @Body() dto: AttachStoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.attach(user.userId, id, dto.memoryId);
  }

  @Delete(':id')
  hide(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.hide(user.userId, id);
  }
}
