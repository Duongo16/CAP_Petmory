import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Goods, GoodsDocument } from './schemas/goods.schema';
import { GoodsCategory, GoodsCategoryDocument } from './schemas/goods-category.schema';
import {
  CreateGoodsDto,
  GoodsCategoryDto,
  GoodsVariantDto,
  UpdateGoodsCategoryDto,
  UpdateGoodsDto,
} from './dto/goods.dto';
import { MSG } from '../../common/constants/messages';

/** Ma co so du lieu tra ve khi mot chi muc duy nhat da co nguoi chiem. */
const DUPLICATE_KEY = 11000;

/** True khi that bai la do co so du lieu tu choi mot ma trung. */
function isDuplicate(trouble: unknown): boolean {
  return (trouble as { code?: number } | null)?.code === DUPLICATE_KEY;
}

/**
 * Quan ly danh muc hang co san.
 *
 * Tach khoi dich vu doc va tru kho, vi day la phan chi nhom Quan ly va Quan
 * tri vien duoc dung, con phan kia thi ca khach cung di qua.
 */
@Injectable()
export class GoodsAdminService {
  constructor(
    @InjectModel(Goods.name) private readonly model: Model<GoodsDocument>,
    @InjectModel(GoodsCategory.name)
    private readonly categoryModel: Model<GoodsCategoryDocument>,
  ) {}

  async createCategory(dto: GoodsCategoryDto): Promise<GoodsCategoryDocument> {
    try {
      return await this.categoryModel.create({ ...dto, code: dto.code.toUpperCase() });
    } catch (trouble) {
      if (isDuplicate(trouble)) {
        throw new ConflictException('Ma nhom hang nay da co roi');
      }
      throw trouble;
    }
  }

  async updateCategory(
    code: string,
    dto: UpdateGoodsCategoryDto,
  ): Promise<GoodsCategoryDocument> {
    const one = await this.categoryModel
      .findOne({ code: code.toUpperCase(), isHidden: false })
      .exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    one.set(onlyGiven({ ...dto }));
    return one.save();
  }

  /**
   * An mot nhom hang.
   *
   * Nhom con hang thi khong an duoc: an di thi nhung mon trong do bien mat
   * khoi trang khach ma khong ai chu y, va cac don cu van tro toi mot nhom
   * khong con nhin thay.
   */
  async hideCategory(code: string): Promise<GoodsCategoryDocument> {
    const one = await this.categoryModel
      .findOne({ code: code.toUpperCase(), isHidden: false })
      .exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const still = await this.model.countDocuments({ category: one._id, isHidden: false }).exec();
    if (still > 0) {
      throw new BadRequestException('Nhom nay van con hang, hay chuyen hang sang nhom khac truoc');
    }
    one.isHidden = true;
    one.enabled = false;
    return one.save();
  }

  async createGoods(dto: CreateGoodsDto): Promise<GoodsDocument> {
    const group = await this.categoryModel
      .findOne({ _id: dto.category, isHidden: false })
      .exec();
    if (!group) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    checkVariants(dto.variant, dto.optionNames ?? []);
    try {
      return await this.model.create({
        ...dto,
        code: dto.code.toUpperCase(),
        category: group._id,
        variant: dto.variant.map(asVariant),
      });
    } catch (trouble) {
      if (isDuplicate(trouble)) {
        throw new ConflictException('Ma san pham nay da co roi');
      }
      throw trouble;
    }
  }

  /**
   * Sua mot mon hang.
   *
   * Gui kem danh sach to hop thi danh sach cu bi thay han. So ton kho cua
   * nhung to hop van con duoc giu lai, vi ton kho la so hang thuc te trong
   * kho chu khong phai mot o do nguoi sua go vao.
   */
  async updateGoods(code: string, dto: UpdateGoodsDto): Promise<GoodsDocument> {
    const one = await this.model.findOne({ code: code.toUpperCase(), isHidden: false }).exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    if (dto.category) {
      const group = await this.categoryModel
        .findOne({ _id: dto.category, isHidden: false })
        .exec();
      if (!group) {
        throw new NotFoundException(MSG.NOT_FOUND);
      }
    }

    const fields: Record<string, unknown> = onlyGiven({ ...dto });
    if (dto.variant) {
      checkVariants(dto.variant, dto.optionNames ?? one.optionNames);
      const stockOf = new Map(one.variant.map((old) => [old.sku, old.stock]));
      fields['variant'] = dto.variant.map((fresh) => ({
        ...asVariant(fresh),
        stock: stockOf.get(fresh.sku.toUpperCase()) ?? fresh.stock ?? 0,
      }));
    }
    one.set(fields);
    return one.save();
  }

  /** An mot mon hang. Don cu van giu nguyen ten va gia da chot. */
  async hideGoods(code: string): Promise<GoodsDocument> {
    const one = await this.model.findOne({ code: code.toUpperCase(), isHidden: false }).exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    one.isHidden = true;
    one.enabled = false;
    return one.save();
  }
}

/** Doi mot to hop tu dang gui len sang dang luu trong co so du lieu. */
function asVariant(one: GoodsVariantDto) {
  return {
    sku: one.sku.toUpperCase(),
    optionValues: one.optionValues,
    price: Types.Decimal128.fromString(one.price),
    stock: one.stock ?? 0,
    enabled: one.enabled ?? true,
  };
}

/**
 * Kiem cac to hop truoc khi ghi.
 *
 * Hai to hop trung ma thi khong ai biet don hang tro toi to hop nao, con so
 * gia tri thuoc tinh khong khop voi so ten thuoc tinh thi trang khach khong
 * dung duoc bang chon.
 */
function checkVariants(list: GoodsVariantDto[], optionNames: string[]): void {
  const seen = new Set<string>();
  for (const one of list) {
    const sku = one.sku.toUpperCase();
    if (seen.has(sku)) {
      throw new BadRequestException(`Ma to hop ${sku} bi lap lai`);
    }
    seen.add(sku);
    if (one.optionValues.length !== optionNames.length) {
      throw new BadRequestException(
        'So gia tri thuoc tinh cua moi to hop phai bang so ten thuoc tinh da dat',
      );
    }
  }
}

/** Bo cac o khong duoc gui len, de chung khong xoa mat gia tri dang co. */
function onlyGiven(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (value !== undefined) {
      out[name] = value;
    }
  }
  return out;
}
