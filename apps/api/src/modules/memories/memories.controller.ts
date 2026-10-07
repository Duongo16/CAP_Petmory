import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { MemoriesService } from './memories.service';
import { DiaryService } from './diary.service';
import { DiaryExportService } from './diary-export.service';
import { CreateMemoryDto, UpdateMemoryDto } from './dto/memory.dto';
import {
  DiaryPrivacyDto,
  ExportDiaryDto,
  MakeShareDto,
  SlideSettingDto,
} from './dto/diary.dto';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { MemoryTopic } from './schemas/memory.schema';

/**
 * Turns the wording in the address bar into one of the known topics.
 * Anything else is treated as no filter at all, rather than being passed
 * through to the database as written.
 */
function asTopic(raw?: string): MemoryTopic | undefined {
  const upper = (raw ?? '').toUpperCase();
  return (Object.values(MemoryTopic) as string[]).includes(upper)
    ? (upper as MemoryTopic)
    : undefined;
}

@Controller('memories')
export class MemoriesController {
  constructor(
    private readonly service: MemoriesService,
    private readonly diary: DiaryService,
    private readonly exporter: DiaryExportService,
  ) {}

  /** The newest moments across every pet, for the daily summary. */
  @Get('recent')
  recent(@CurrentUser() user: AuthUser) {
    return this.service.recent(user.userId);
  }

  /** A moment from an earlier year falling near today. */
  @Get('on-this-day')
  onThisDay(@CurrentUser() user: AuthUser) {
    return this.service.onThisDay(user.userId);
  }

  @Get('pet/:petId')
  listForPet(
    @Param('petId') petId: string,
    @CurrentUser() user: AuthUser,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('topic') topic?: string,
  ) {
    return this.service.listForPet(
      petId,
      user.userId,
      page && page > 0 ? page : 1,
      asTopic(topic),
    );
  }

  /** Quyen nay cho nguoi ngoai doc hay khong. Mac dinh la khong. */
  @Patch('pet/:petId/privacy')
  setPrivacy(
    @Param('petId') petId: string,
    @Body() dto: DiaryPrivacyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.diary.setPublic(petId, user.userId, dto.isPublic);
  }

  /** Luu cach trinh chieu cua quyen nay: bai nhac, hieu ung, thoi luong. */
  @Patch('pet/:petId/slideshow')
  setSlide(
    @Param('petId') petId: string,
    @Body() dto: SlideSettingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.diary.setSlide(petId, user.userId, dto);
  }

  /**
   * Tao mot duong dan chia se.
   *
   * Ma tra ve o day la lan duy nhat no xuat hien, vi may chu chi giu ban bam
   * cua no. Man hinh phai hien ngay cho nguoi dung sao lai.
   */
  @Post('pet/:petId/shares')
  async makeShare(
    @Param('petId') petId: string,
    @Body() dto: MakeShareDto,
    @CurrentUser() user: AuthUser,
  ) {
    const made = await this.diary.makeShare(petId, user.userId, dto.expiresAt ?? null);
    return { share: made.share, code: made.code };
  }

  @Get('pet/:petId/shares')
  listShares(@Param('petId') petId: string, @CurrentUser() user: AuthUser) {
    return this.diary.listShares(petId, user.userId);
  }

  @Delete('shares/:id')
  revokeShare(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.diary.revokeShare(id, user.userId);
  }

  /** Xin xuat quyen nhat ky ra tep. Viec dung tep chay o phia sau. */
  @Post('pet/:petId/exports')
  requestExport(
    @Param('petId') petId: string,
    @Body() dto: ExportDiaryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.exporter.request(petId, user.userId, dto.fromDate, dto.toDate);
  }

  @Get('pet/:petId/exports')
  listExports(@Param('petId') petId: string, @CurrentUser() user: AuthUser) {
    return this.exporter.listFor(petId, user.userId);
  }

  @Get('exports/:id')
  exportState(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.exporter.statusOf(id, user.userId);
  }

  /** Tai tep da xuat. Chi chu so huu tai duoc, ke ca voi quyen cong khai. */
  @Get('exports/:id/file')
  async exportFile(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const file = await this.exporter.fileOf(id, user.userId);
    if (file.address) {
      // Dia chi tai het han sau vai phut, chi cap sau khi da kiem chu so huu.
      res.setHeader('Cache-Control', 'private, no-store');
      res.redirect(302, file.address);
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.bytes);
  }

  @Post()
  create(@Body() dto: CreateMemoryDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMemoryDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user.userId);
  }

  @Delete(':id')
  hide(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.hide(id, user.userId);
  }
}
