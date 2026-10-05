import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RestoreOperation } from './dto/photo.dto';
import { measureResemblance, restorePhoto, scorePhoto } from './image-tool';
import { BusinessConfigService } from '../business-config/business-config.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { AiKind, AiMode } from '../ai/schemas/ai-usage.schema';
import { MSG } from '../../common/constants/messages';

/** Moi tam anh gui len deu duoc lam cung mot bo thao tac nay. */
const OPERATIONS: RestoreOperation[] = ['UPSCALE', 'SHARPEN', 'DENOISE', 'EXPOSURE'];

const ALLOWED_TYPES = new Set(['jpeg', 'jpg', 'png']);
const ERROR_FILE_TYPE = 'Chi nhan anh JPG, JPEG hoac PNG';
const KEY_QUOTA_RESTORE = 'restorePhoto';

/** Ba khung han muc, dem lui tu bay gio. */
const QUOTA_WINDOWS: { name: 'day' | 'month' | 'year'; hours: number }[] = [
  { name: 'day', hours: 24 },
  { name: 'month', hours: 24 * 30 },
  { name: 'year', hours: 24 * 365 },
];

/** Ket qua phuc hoi: noi dung anh moi va do giong voi anh goc. */
export interface RestoreOutcome {
  data: Buffer;
  resemblance: number;
}

/**
 * Phuc hoi mot tam anh rieng le, khong dinh dang gi toi ho so thu cung.
 *
 * Anh gui len chi nam trong bo nho trong luc xu ly roi tra thang ve cho nguoi
 * goi; khong tep nao duoc ghi xuong kho va khong ban ghi anh nao duoc tao. Chi
 * so luot dung duoc ghi lai, vi han muc va bao cao chi phi doc tu so do.
 */
@Injectable()
export class PhotoRestoreService {
  constructor(
    private readonly businessConfig: BusinessConfigService,
    private readonly usage: AiUsageService,
  ) {}

  async run(owner: string, file: Express.Multer.File | undefined): Promise<RestoreOutcome> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Chua chon tep anh nao');
    }
    const cf = await this.businessConfig.get();
    if (file.size > cf.maxPhotoSizeMb * 1024 * 1024) {
      throw new BadRequestException(`Anh vuot qua ${cf.maxPhotoSizeMb} MB`);
    }

    // Kiem dinh dang that cua tep, khong tin phan mo rong ten tep.
    const { fileType } = await scorePhoto(file.buffer, {
      shortEdgeOk: cf.goodShortEdgePx,
      shortEdgeWarning: cf.warnShortEdgePx,
    }).catch(() => {
      throw new BadRequestException(ERROR_FILE_TYPE);
    });
    if (!ALLOWED_TYPES.has(fileType)) {
      throw new BadRequestException(ERROR_FILE_TYPE);
    }

    await this.checkQuota(owner, cf.aiQuota?.[KEY_QUOTA_RESTORE]);

    const data = await restorePhoto(file.buffer, OPERATIONS);
    const resemblance = await measureResemblance(file.buffer, data);
    await this.usage.record(AiKind.RESTORE_PHOTO, owner, AiMode.LOCAL);
    return { data, resemblance };
  }

  /** So so luot da dung trong tung khung voi han muc nhom Quan ly dat ra. */
  private async checkQuota(
    owner: string,
    quota: { day: number; month: number; year: number } | undefined,
  ): Promise<void> {
    if (!quota) {
      return;
    }
    for (const window of QUOTA_WINDOWS) {
      const cap = quota[window.name];
      if (!cap || cap <= 0) {
        continue;
      }
      const since = new Date(Date.now() - window.hours * 60 * 60 * 1000);
      if ((await this.usage.countFor(owner, AiKind.RESTORE_PHOTO, since)) >= cap) {
        throw new HttpException(MSG.RESTORE_QUOTA_REACHED, HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }
}
