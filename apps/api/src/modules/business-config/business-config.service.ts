import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BusinessConfig, BusinessConfigDocument } from './schemas/business-config.schema';
import { UpdateConfigDto } from './dto/business-config.dto';

const KEY_DEFAULT = 'DEFAULT';

@Injectable()
export class BusinessConfigService {
  constructor(
    @InjectModel(BusinessConfig.name) private readonly model: Model<BusinessConfigDocument>,
  ) {}

  /**
   * Always returns a record, making one on first use.
   *
   * The write decides whether the row is made or read, rather than looking
   * first and writing after: two calls arriving together both found nothing
   * and the second was refused by the database.
   */
  async get(): Promise<BusinessConfigDocument> {
    return this.model
      .findOneAndUpdate(
        { key: KEY_DEFAULT },
        { $setOnInsert: { key: KEY_DEFAULT } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async update(
    replaceChange: UpdateConfigDto,
    editor: string,
  ): Promise<BusinessConfigDocument> {
    const before = await this.get();
    this.checkThresholdOrder(replaceChange, before);
    this.checkMusicCodes(replaceChange);
    const after = await this.model
      .findOneAndUpdate(
        { key: KEY_DEFAULT },
        { $set: { ...this.asFields(replaceChange), lastEditedBy: editor } },
        { new: true },
      )
      .exec();
    return after ?? before;
  }

  /** Ma bai nhac la khoa trong cai dat trinh chieu cua tung nhat ky, nen khong duoc trung. */
  private checkMusicCodes(replaceChange: UpdateConfigDto): void {
    const codes = (replaceChange.musicLibrary ?? []).map((one) => one.code);
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('Ma bai nhac bi trung');
    }
  }

  /**
   * Trai don gia va han muc ra thanh tung duong dan rieng.
   *
   * Ghi ca cum mot luc thi nhung muc khong duoc gui se bi xoa, tuc la doi mot
   * muc se am tham lam mat cac muc con lai. Ghi theo tung duong dan thi chi
   * dung vao dung muc nguoi dung vua sua.
   */
  private asFields(replaceChange: UpdateConfigDto): Record<string, unknown> {
    const { aiUnitPrice, aiQuota, ...rest } = replaceChange;
    const out: Record<string, unknown> = { ...rest };
    for (const [name, value] of Object.entries(aiUnitPrice ?? {})) {
      if (value !== undefined) {
        out[`aiUnitPrice.${name}`] = value;
      }
    }
    for (const [name, value] of Object.entries(aiQuota ?? {})) {
      if (value !== undefined) {
        out[`aiQuota.${name}`] = value;
      }
    }
    return out;
  }

  /**
   * The warning threshold must sit below the acceptable one, otherwise no photo
   * ever lands in the "suggest restoration" band and the scoring loses its point.
   */
  private checkThresholdOrder(
    replaceChange: UpdateConfigDto,
    current: BusinessConfigDocument,
  ): void {
    const set = replaceChange.goodShortEdgePx ?? current.goodShortEdgePx;
    const warning = replaceChange.warnShortEdgePx ?? current.warnShortEdgePx;
    if (warning >= set) {
      throw new BadRequestException(
        'Nguong canh bao phai nho hon nguong do phan giai dat yeu cau',
      );
    }
  }
}
