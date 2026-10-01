import { Controller, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PhotoRestoreService } from './photo-restore.service';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

/** Ten dau muc mang do giong anh goc, de trang web doc duoc cung tam anh. */
export const HEADER_RESEMBLANCE = 'X-Resemblance';

@Controller('photo-restore')
export class PhotoRestoreController {
  constructor(private readonly service: PhotoRestoreService) {}

  /** Nhan mot tam anh, tra lai ngay ban da phuc hoi dang PNG. */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async restore(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const outcome = await this.service.run(user.userId, file);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(HEADER_RESEMBLANCE, String(outcome.resemblance));
    res.send(outcome.data);
  }
}
