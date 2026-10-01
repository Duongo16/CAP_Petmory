import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DiaryService } from './diary.service';
import { BusinessConfigService } from '../business-config/business-config.service';
import { PublicDiaryQueryDto } from './dto/diary.dto';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Duong doc cac quyen nhat ky dang de cong khai.
 *
 * Moi duong o day deu mo cho nguoi chua dang nhap, vi cong khai phai la cong
 * khai that. Bu lai, khong duong nao o day ghi duoc gi, va noi dung tra ve
 * da bo het du lieu dinh danh cua mot nha.
 */
@Controller('diaries')
export class PublicDiaryController {
  constructor(
    private readonly service: DiaryService,
    private readonly config: BusinessConfigService,
  ) {}

  /**
   * Kho nhac dung cho trinh chieu.
   *
   * Dat truoc cac duong co tham so, neu khong thi chu music se bi hieu la ma
   * cua mot quyen nhat ky.
   */
  @Public()
  @Get('music')
  async music() {
    const setting = await this.config.get();
    return setting.musicLibrary.map((one) => ({
      code: one.code,
      title: one.title,
      url: one.url,
      credit: one.credit,
    }));
  }

  /**
   * Bytes cua mot buc anh trong quyen cong khai.
   *
   * Dat truoc duong co tham so mot doan, de chu photo khong bi hieu la ma
   * cua mot quyen nhat ky.
   */
  @Public()
  @Get('photo/:photoId')
  async photo(@Param('photoId') photoId: string, @Res() res: Response): Promise<void> {
    const found = await this.service.publicPhoto(photoId);
    const kind = found.fileType === 'jpg' ? 'jpeg' : found.fileType;
    res.setHeader('Content-Type', `image/${kind}`);
    res.setHeader('Cache-Control', 'public, max-age=600');
    /*
     * Cho phep trang web o dia chi khac nhung anh nay vao.
     *
     * Mac dinh may chu chi cho chinh no dung tai nguyen cua minh, nen trang
     * web goi anh tu mot cong khac se bi trinh duyet chan. Anh o duong nay
     * von da la anh cong khai, nen mo ra la dung.
     */
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(found.data);
  }

  @Public()
  @Get()
  list(@Query() query: PublicDiaryQueryDto) {
    return this.service.publicList(query.page ?? 1, query.topic, query.keyword);
  }

  /** Doc bang duong dan chia se. Dat truoc duong co tham so de khong bi nuot. */
  @Public()
  @Get('share/:code')
  byShare(@Param('code') code: string) {
    return this.service.bookByCode(code);
  }

  @Public()
  @Get(':petId')
  book(@Param('petId') petId: string) {
    return this.service.publicBook(petId);
  }
}
