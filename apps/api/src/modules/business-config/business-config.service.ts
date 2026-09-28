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

  /** Always returns a record, creating one if none exists yet. */
  async get(): Promise<BusinessConfigDocument> {
    const existing = await this.model.findOne({ key: KEY_DEFAULT }).exec();
    if (existing) {
      return existing;
    }
    return this.model.create({ key: KEY_DEFAULT });
  }

  async update(
    replaceChange: UpdateConfigDto,
    editor: string,
  ): Promise<BusinessConfigDocument> {
    const before = await this.get();
    this.checkThresholdOrder(replaceChange, before);
    const after = await this.model
      .findOneAndUpdate(
        { key: KEY_DEFAULT },
        { $set: { ...replaceChange, lastEditedBy: editor } },
        { new: true },
      )
      .exec();
    return after ?? before;
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
