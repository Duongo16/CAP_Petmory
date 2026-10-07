import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AI_OPERATIONS, RestoreOperation } from './dto/photo.dto';
import sharp from 'sharp';
import { ConfigService } from '@nestjs/config';
import { AiClientService } from '../ai/ai-client.service';
import { CloudinaryImageAi } from './cloudinary-image-ai';
import { fitPicture, measureResemblance, restorePhoto, scorePhoto } from './image-tool';
import { BusinessConfigService } from '../business-config/business-config.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { AiKind, AiMode } from '../ai/schemas/ai-usage.schema';
import { MSG } from '../../common/constants/messages';

/** Bo thao tac mac dinh khi khach khong chon gi. */
const OPERATIONS: RestoreOperation[] = ['UPSCALE', 'SHARPEN', 'DENOISE', 'EXPOSURE'];

/** Loi dan cho tung thao tac AI; luon nhac giu nguyen dac diem cua be. */
const AI_INSTRUCTION: Record<string, string> = {
  REMOVE_BACKGROUND:
    'Remove the background completely and replace it with a plain pure white background. Keep the pet exactly as it is: same shape, pose, fur colours and markings.',
  FACE_DETAIL:
    "Enhance the detail and sharpness of the pet's face, eyes, nose and fur texture. Do not change the pet's shape, markings, colours, proportions or expression.",
};

const ALLOWED_TYPES = new Set(['jpeg', 'jpg', 'png']);
const ERROR_FILE_TYPE = 'Chi nhan anh JPG, JPEG hoac PNG';
const KEY_QUOTA_RESTORE = 'restorePhoto';

/** Ba khung han muc, dem lui tu bay gio. */
const QUOTA_WINDOWS: { name: 'day' | 'month' | 'year'; hours: number }[] = [
  { name: 'day', hours: 24 },
  { name: 'month', hours: 24 * 30 },
  { name: 'year', hours: 24 * 365 },
];

/** So luot phuc hoi con lai: han muc moi ngay va so luot con dung duoc, am la khong gioi han. */
export interface RestoreQuotaLeft {
  day: number;
  left: number;
}

/** Ket qua phuc hoi: noi dung anh moi va do giong voi anh goc. */
export interface RestoreOutcome {
  data: Buffer;
  resemblance: number;
  /** LIVE khi co thao tac AI chay that, LOCAL khi chi dung bo loc tai may. */
  mode: AiMode;
  /** Cac thao tac AI da chon nhung khong lam duoc (chua co khoa, goi hong). */
  skipped: string[];
  /** Loai noi dung cua anh tra ve: PNG khi con gon, JPEG khi phai nen cho vua. */
  mimeType: string;
}

/**
 * Phuc hoi mot tam anh rieng le, khong dinh dang gi toi ho so thu cung.
 *
 * Anh gui len khong duoc ghi xuong kho va khong ban ghi anh nao duoc tao. Khi
 * chon thao tac AI, anh duoc gui tam sang dich vu sua anh roi bi xoa ngay sau
 * khi doc ket qua. Chi so luot dung duoc ghi lai, vi han muc va bao cao chi
 * phi doc tu so do.
 *
 * Dich vu sua anh mac dinh la Cloudinary, chay duoc tren goi mien phi. Dat
 * bien moi truong chon nha cung cap anh la gemini de quay ve mo hinh Gemini.
 */
@Injectable()
export class PhotoRestoreService {
  constructor(
    private readonly businessConfig: BusinessConfigService,
    private readonly usage: AiUsageService,
    private readonly ai: AiClientService,
    private readonly cloud: CloudinaryImageAi,
    private readonly config: ConfigService,
  ) {}

  /** Dung dich vu anh tru khi da chon ro Gemini, hoac dich vu anh chua cau hinh. */
  private get useCloud(): boolean {
    const wanted = this.config.get<string>('ai.imageProvider') ?? '';
    return wanted !== 'gemini' && this.cloud.ready;
  }

  async run(owner: string, file: Express.Multer.File | undefined, chosen: RestoreOperation[] = []): Promise<RestoreOutcome> {
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

    const wanted = chosen.length > 0 ? [...new Set(chosen)] : OPERATIONS;
    const local = wanted.filter((one) => !AI_OPERATIONS.includes(one));
    const aiWanted = wanted.filter((one) => AI_OPERATIONS.includes(one));

    // Bo loc tai may chay truoc, roi moi gui ket qua cho mo hinh sua anh.
    let data = local.length > 0 ? await restorePhoto(file.buffer, local) : await sharp(file.buffer).rotate().png().toBuffer();
    let mode = AiMode.LOCAL;
    let skipped: string[] = [];
    let problem = '';
    if (aiWanted.length > 0) {
      const edited = this.useCloud
        ? await this.cloud.edit(data, aiWanted)
        : await this.ai.editImage(data, 'image/png', aiWanted.map((one) => AI_INSTRUCTION[one]).join(' '));
      if (edited.data) {
        data = await sharp(edited.data).png({ compressionLevel: 8 }).toBuffer();
        mode = AiMode.LIVE;
      } else {
        // Ghi ro thao tac AI nao khong lam duoc, khong lang le coi nhu da lam.
        skipped = aiWanted;
        problem = edited.problem;
      }
    }
    const resemblance = await measureResemblance(file.buffer, data);
    await this.usage.record(AiKind.RESTORE_PHOTO, owner, mode, undefined, problem);
    const fitted = await fitPicture(data);
    return { data: fitted.data, resemblance, mode, skipped, mimeType: fitted.mimeType };
  }

  /**
   * So luot phuc hoi con lai cua khach, de man hinh bao truoc khi khach bam.
   *
   * Lay khung chat nhat trong cac khung da dat han muc. Khong dat han muc nao
   * thi bao khong gioi han bang so am.
   */
  async remaining(owner: string): Promise<RestoreQuotaLeft> {
    const cf = await this.businessConfig.get();
    const quota = cf.aiQuota?.[KEY_QUOTA_RESTORE];
    let left = -1;
    for (const window of QUOTA_WINDOWS) {
      const cap = quota?.[window.name] ?? 0;
      if (cap <= 0) {
        continue;
      }
      const since = new Date(Date.now() - window.hours * 60 * 60 * 1000);
      const used = await this.usage.countFor(owner, AiKind.RESTORE_PHOTO, since);
      const here = Math.max(0, cap - used);
      left = left < 0 ? here : Math.min(left, here);
    }
    return { day: quota?.day ?? 0, left };
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
