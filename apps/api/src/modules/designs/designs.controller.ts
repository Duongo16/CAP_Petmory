import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DesignsService } from './designs.service';
import { ACCESSORY_PICK_MAX, RenameDesignDto, SaveDesignDto, UploadPreviewDto } from './dto/design.dto';
import { PreviewAngle } from './schemas/design.schema';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('designs')
export class DesignsController {
  constructor(private readonly service: DesignsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.listMine(user.userId);
  }

  /** Quote comes from the catalog. Declared before the parameterised path so it is not shadowed. */
  @Get('quote')
  quote(
    @Query('productTypeCode') kind: string,
    @Query('sizeCode') size: string,
    @Query('baseCode') baseCode?: string,
    @Query('accessories') accessories?: string,
  ) {
    // Danh sach phu kien gui dang chuoi ngan cach bang dau phay; mot mau co toi da bon diem neo.
    const codes = (accessories ?? '').split(',').map((one) => one.trim()).filter(Boolean);
    if (codes.length > ACCESSORY_PICK_MAX) {
      throw new BadRequestException('Qua nhieu phu kien');
    }
    return this.service.quote(kind ?? '', size ?? '', baseCode, codes);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOwned(id, user.userId);
  }

  /**
   * Serves the preview through a permission-checked path rather than exposing the
   * storage folder. Anyone who is not the owner gets a not-found.
   */
  @Get(':id/preview/:angle')
  async photo(
    @Param('id') id: string,
    @Param('angle') angle: PreviewAngle,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.service.readPreview(id, user.userId, angle);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(data);
  }

  @Post()
  create(@Body() dto: SaveDesignDto, @CurrentUser() user: AuthUser) {
    return this.service.create(user.userId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: SaveDesignDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, user.userId, dto);
  }

  /** Doi ten rieng, de khong phai gui lai ca ban thiet ke va lo xoa mat mau da to. */
  @Patch(':id/name')
  rename(@Param('id') id: string, @Body() dto: RenameDesignDto, @CurrentUser() user: AuthUser) {
    return this.service.rename(id, user.userId, dto.name.trim());
  }

  @Post(':id/preview')
  @UseInterceptors(FileInterceptor('file'))
  loadPhoto(
    @Param('id') id: string,
    @Body() dto: UploadPreviewDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.savePreview(id, user.userId, dto.angle, file);
  }

  @Delete(':id')
  hide(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.hide(id, user.userId);
  }
}
