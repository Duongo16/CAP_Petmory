import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { StorageFolder, StorageService } from '../../common/storage/storage.service';
import { MSG } from '../../common/constants/messages';

/** Anh san pham toi da 10 MB, bang muc anh bai viet cong dong. */
export const GOODS_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const ENDING_OF: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const TYPE_OF: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const NOT_AN_IMAGE = 'Chi nhan anh JPG, PNG hoac WEBP';

/** Ten tep do may chu dat: ma ngau nhien kem duoi anh. Ten khac thi khong doc. */
const NAME_SHAPE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

/**
 * Anh hang co san tai len tu may cua quan ly.
 *
 * Mon hang chi giu dia chi anh, nen anh duoc luu truoc, tra ve dia chi, roi
 * moi gan vao mon hang khi quan ly bam luu. Kho anh la nhom cong khai: day la
 * anh ban hang, ai xem trang shop cung thay.
 */
@Injectable()
export class GoodsImageService {
  constructor(private readonly storage: StorageService) {}

  /** Kiem va luu anh, tra ve ten tep da dat. */
  async save(file?: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('Chua chon tep anh nao');
    }
    const ending = ENDING_OF[file.mimetype];
    if (!ending) {
      throw new BadRequestException(NOT_AN_IMAGE);
    }
    if (file.size > GOODS_IMAGE_MAX_BYTES) {
      throw new BadRequestException('Anh vuot qua 10 MB');
    }
    const fileName = `${randomUUID()}.${ending}`;
    await this.storage.save(StorageFolder.GOODS, fileName, file.buffer, file.mimetype);
    return fileName;
  }

  /** Dia chi cong khai cua kho (Cloudinary), hoac rong khi API phai tu tra tep. */
  addressOf(fileName: string): string | null {
    return this.storage.addressOf(StorageFolder.GOODS, fileName);
  }

  async read(fileName: string): Promise<{ data: Buffer; type: string }> {
    if (!NAME_SHAPE.test(fileName)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    try {
      const data = await this.storage.read(StorageFolder.GOODS, fileName);
      return { data, type: TYPE_OF[fileName.split('.').pop() ?? 'jpg'] };
    } catch {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
  }
}
