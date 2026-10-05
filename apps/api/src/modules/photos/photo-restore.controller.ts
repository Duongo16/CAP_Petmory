import { Body, Controller, Get, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { RestoreToolDto } from './dto/photo.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PhotoRestoreService } from './photo-restore.service';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

/** Ten dau muc mang do giong anh goc, de trang web doc duoc cung tam anh. */
export const HEADER_RESEMBLANCE = 'X-Resemblance';
/** Che do phuc hoi (LIVE la co dung AI that) va cac thao tac AI khong lam duoc. */
export const HEADER_MODE = 'X-Restore-Mode';
export const HEADER_SKIPPED = 'X-Restore-Skipped';

@Controller('photo-restore')
export class PhotoRestoreController {
  constructor(private readonly service: PhotoRestoreService) {}

  /** So luot phuc hoi con lai cua chinh nguoi dang dang nhap. */
  @Get('quota')
  quota(@CurrentUser() user: AuthUser) {
    return this.service.remaining(user.userId);
  }

  /** Nhan mot tam anh, tra lai ngay ban da phuc hoi dang PNG. */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async restore(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: RestoreToolDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const outcome = await this.service.run(user.userId, file, dto.operation ?? []);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(HEADER_RESEMBLANCE, String(outcome.resemblance));
    res.setHeader(HEADER_MODE, outcome.mode);
    res.setHeader(HEADER_SKIPPED, outcome.skipped.join(','));
    res.send(outcome.data);
  }
}
