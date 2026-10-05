import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ColorCode, ColorCodeDocument, ColorGroup } from './schemas/color-code.schema';
import { CreateColorCodeDto, UpdateColorCodeDto } from './dto/color-code.dto';
import { ProductType, ProductTypeDocument } from './schemas/product-type.schema';
import { DisplayBase, DisplayBaseDocument } from './schemas/display-base.schema';
import { Accessory, AccessoryDocument } from './schemas/accessory.schema';
import { CreateAccessoryDto, UpdateAccessoryDto } from './dto/accessory.dto';
import {
  ProductReview,
  ProductReviewDocument,
} from '../reviews/schemas/product-review.schema';
import { MSG } from '../../common/constants/messages';

/** The rolled-up rating shown on a product card and on the detail page. */
export interface RatingSummary {
  average: number;
  count: number;
}

/**
 * Escapes characters that carry special meaning inside a search expression.
 * A keyword typed by a user must never turn itself into a pattern.
 */
function escape(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(ColorCode.name) private readonly colorModel: Model<ColorCodeDocument>,
    @InjectModel(ProductType.name) private readonly productTypeModel: Model<ProductTypeDocument>,
    @InjectModel(DisplayBase.name) private readonly displayBaseModel: Model<DisplayBaseDocument>,
    @InjectModel(ProductReview.name) private readonly reviewModel: Model<ProductReviewDocument>,
    @InjectModel(Accessory.name) private readonly accessoryModel: Model<AccessoryDocument>,
  ) {}

  /** Phu kien dung chung. Khach chi thay phu kien dang ban. */
  listAccessory(enabledOnly: boolean) {
    const where = enabledOnly ? { enabled: true } : {};
    return this.accessoryModel.find(where).sort({ sortOrder: 1, displayName: 1 }).exec();
  }

  /**
   * Doc cac phu kien theo ma, giu nguyen thu tu, va kiem truoc khi dung.
   *
   * Ma la, phu kien dang tat, ma lap lai, hay hai phu kien cung mot diem neo
   * deu bi tu choi: may chu tinh tien theo danh sach nay, va xuong lam theo no.
   */
  async findAccessories(codes: string[] | undefined): Promise<AccessoryDocument[]> {
    const wanted = (codes ?? []).map((one) => one.trim().toUpperCase()).filter(Boolean);
    if (wanted.length === 0) {
      return [];
    }
    if (new Set(wanted).size !== wanted.length) {
      throw new BadRequestException('Phu kien bi lap lai');
    }
    const found = await this.accessoryModel.find({ code: { $in: wanted }, enabled: true }).exec();
    const byCode = new Map(found.map((one) => [one.code, one]));
    const missing = wanted.filter((code) => !byCode.has(code));
    if (missing.length > 0) {
      throw new BadRequestException(`Phu kien khong con ban: ${missing.join(', ')}`);
    }
    const list = wanted.map((code) => byCode.get(code) as AccessoryDocument);
    const anchors = list.map((one) => one.anchor);
    if (new Set(anchors).size !== anchors.length) {
      throw new BadRequestException('Moi diem neo chi gan duoc mot phu kien');
    }
    return list;
  }

  async createAccessory(dto: CreateAccessoryDto): Promise<AccessoryDocument> {
    try {
      return await this.accessoryModel.create({
        ...dto,
        code: dto.code.toUpperCase(),
        priceDelta: Types.Decimal128.fromString(dto.priceDelta),
      });
    } catch (trouble) {
      if ((trouble as { code?: number } | null)?.code === 11000) {
        throw new ConflictException('Ma phu kien nay da co roi');
      }
      throw trouble;
    }
  }

  async updateAccessory(code: string, dto: UpdateAccessoryDto) {
    const one = await this.accessoryModel.findOne({ code: code.toUpperCase() }).exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const before = one.toObject();
    const { priceDelta, ...rest } = dto;
    for (const [name, value] of Object.entries(rest)) {
      if (value !== undefined) {
        one.set(name, value);
      }
    }
    if (priceDelta !== undefined) {
      one.priceDelta = Types.Decimal128.fromString(priceDelta);
    }
    const after = await one.save();
    return { before, after };
  }

  /** Customers see enabled colours only. Internal staff see all of them. */
  listColor(enabledOnly: boolean, group?: ColorGroup) {
    const where: Record<string, unknown> = {};
    if (enabledOnly) {
      where.enabled = true;
    }
    if (group) {
      where.group = group;
    }
    return this.colorModel.find(where).sort({ group: 1, sortOrder: 1 }).exec();
  }

  /**
   * Lists product types, optionally narrowed by a keyword typed in the header.
   * The keyword is escaped, so it can only ever be matched as plain text.
   */
  listProductType(enabledOnly: boolean, keyword?: string) {
    const where: Record<string, unknown> = enabledOnly ? { enabled: true } : {};
    const trimmed = keyword?.trim();
    if (trimmed) {
      const pattern = new RegExp(escape(trimmed), 'i');
      where.$or = [{ name: pattern }, { code: pattern }, { description: pattern }];
    }
    return this.productTypeModel.find(where).sort({ sortOrder: 1 }).exec();
  }

  async detailProductType(code: string): Promise<ProductTypeDocument> {
    const kind = await this.productTypeModel.findOne({ code: code.toUpperCase() }).exec();
    if (!kind) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return kind;
  }

  /** The stands a figure can be mounted on, cheapest first. */
  listDisplayBase(enabledOnly: boolean) {
    const where = enabledOnly ? { enabled: true } : {};
    return this.displayBaseModel.find(where).sort({ sortOrder: 1 }).exec();
  }

  /**
   * Looks up one stand. An empty code is allowed and means the customer did
   * not pick a stand at all, so no price is added.
   */
  async findDisplayBase(code?: string | null): Promise<DisplayBaseDocument | null> {
    const trimmed = code?.trim();
    if (!trimmed) {
      return null;
    }
    const base = await this.displayBaseModel
      .findOne({ code: trimmed.toUpperCase(), enabled: true })
      .exec();
    if (!base) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return base;
  }

  /**
   * Rolls up the ratings for a set of products in one query, so a list of
   * products does not fire one query per card.
   */
  async ratingByProduct(codes: string[]): Promise<Map<string, RatingSummary>> {
    const out = new Map<string, RatingSummary>();
    if (codes.length === 0) {
      return out;
    }
    const group = await this.reviewModel
      .aggregate<{ _id: string; average: number; count: number }>([
        { $match: { productTypeCode: { $in: codes }, isHidden: false } },
        { $group: { _id: '$productTypeCode', average: { $avg: '$rating' }, count: { $sum: 1 } } },
      ])
      .exec();
    for (const row of group) {
      out.set(row._id, { average: Math.round(row.average * 10) / 10, count: row.count });
    }
    return out;
  }

  /**
   * Adds a wool colour. The code is rejected if it already exists, because the
   * code is what ties a swatch on screen to a real roll in the store.
   */
  async createColor(dto: CreateColorCodeDto): Promise<ColorCodeDocument> {
    const code = dto.code.toUpperCase();
    if (await this.colorModel.exists({ code })) {
      throw new ConflictException('Ma mau nay da ton tai');
    }
    return this.colorModel.create({
      code,
      displayName: dto.displayName,
      swatch: dto.swatch,
      group: dto.group,
      note: dto.note ?? '',
      sortOrder: dto.sortOrder ?? 0,
      enabled: true,
    });
  }

  /**
   * Edits a wool colour. The code is deliberately not editable: orders already
   * placed record the code, and renaming it would leave them pointing at nothing.
   */
  async updateColor(
    code: string,
    dto: UpdateColorCodeDto,
  ): Promise<{ before: ColorCodeDocument; after: ColorCodeDocument }> {
    const before = await this.colorModel.findOne({ code: code.toUpperCase() }).exec();
    if (!before) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const after = await this.colorModel
      .findOneAndUpdate({ code: before.code }, { $set: { ...dto } }, { new: true })
      .exec();
    return { before, after: after as ColorCodeDocument };
  }

  async toggleColor(code: string, enabled: boolean): Promise<ColorCodeDocument> {
    const color = await this.colorModel
      .findOneAndUpdate({ code: code.toUpperCase() }, { $set: { enabled } }, { new: true })
      .exec();
    if (!color) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return color;
  }
}
