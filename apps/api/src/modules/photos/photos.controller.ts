import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PhotosService } from './photos.service';
import { RestoreDto, UploadPhotoDto, ConfirmDto } from './dto/photo.dto';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('pet-photos')
export class PhotosController {
  constructor(private readonly service: PhotosService) {}

  @Get()
  list(@Query('pet') pet: string, @CurrentUser() user: AuthUser) {
    return this.service.listByPet(pet, user.userId);
  }

  @Get('check-angles')
  checkAngle(@Query('pet') pet: string, @CurrentUser() user: AuthUser) {
    return this.service.checkRequiredAngles(pet, user.userId);
  }

  /**
   * Serves the image bytes through a permission-checked path rather than exposing
   * the storage folder. Anyone who is not the owner gets a not-found.
   */
  @Get(':id/content')
  async content(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const { data, fileType } = await this.service.readContent(id, user.userId);
    res.setHeader('Content-Type', `image/${fileType === 'jpg' ? 'jpeg' : fileType}`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(data);
  }

  @Post(':pet')
  @UseInterceptors(FileInterceptor('file'))
  load(
    @Param('pet') pet: string,
    @Body() dto: UploadPhotoDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.load(pet, user.userId, dto.angle, file);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @Body() dto: RestoreDto, @CurrentUser() user: AuthUser) {
    return this.service.restore(id, user.userId, dto.operation);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Body() dto: ConfirmDto, @CurrentUser() user: AuthUser) {
    return this.service.confirm(id, user.userId, dto.accept ?? true);
  }

  @Delete(':id')
  hide(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.hide(id, user.userId);
  }
}
