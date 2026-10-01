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
import { AttachPhotoDto, RestoreDto, UploadPhotoDto, ConfirmDto } from './dto/photo.dto';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ImageLinkDto } from '../../common/storage/image-link.dto';
import { RemoteImageService } from '../../common/storage/remote-image';

@Controller('pet-photos')
export class PhotosController {
  constructor(
    private readonly service: PhotosService,
    private readonly remote: RemoteImageService,
  ) {}

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

  @Get('restoration')
  listLoose(@CurrentUser() user: AuthUser) {
    return this.service.listLoose(user.userId);
  }

  /**
   * Takes one photograph, cleans it up, and hands back both versions.
   *
   * Nothing is attached to a pet here. The caller decides afterwards whether to
   * keep the result, by downloading it or by attaching it to a profile.
   */
  @Post('restoration')
  @UseInterceptors(FileInterceptor('file'))
  async restoreFresh(
    @Body() dto: RestoreDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    const original = await this.service.loadLoose(user.userId, file);
    const restored = await this.service.restore(original.id, user.userId, dto.operation);
    return { original, restored };
  }

  @Post(':id/attach')
  attach(
    @Param('id') id: string,
    @Body() dto: AttachPhotoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.attach(id, dto.pet, user.userId);
  }

  /** Nhan mot duong dan anh tren mang thay cho tep tren may khach. */
  @Post(':pet/from-link')
  async loadByLink(
    @Param('pet') pet: string,
    @Body() dto: ImageLinkDto,
    @CurrentUser() user: AuthUser,
  ) {
    const file = await this.remote.fetch(dto.url);
    return this.service.load(pet, user.userId, undefined, file);
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
