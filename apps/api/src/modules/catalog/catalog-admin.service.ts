import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document, Model, Types } from 'mongoose';
import { ProductType, ProductTypeDocument } from './schemas/product-type.schema';
import { DisplayBase, DisplayBaseDocument } from './schemas/display-base.schema';
import { PackagingKind, PackagingOption, PackagingOptionDocument } from './schemas/packaging-option.schema';
import {
  CreateDisplayBaseDto,
  CreatePackagingDto,
  CreateProductSizeDto,
  CreateProductTypeDto,
  UpdateDisplayBaseDto,
  UpdatePackagingDto,
  UpdateProductSizeDto,
  UpdateProductTypeDto,
} from './dto/catalog-admin.dto';
import { MSG } from '../../common/constants/messages';

/** Ma co so du lieu tra ve khi mot chi muc duy nhat da co nguoi chiem. */
const DUPLICATE_KEY = 11000;

function isDuplicate(trouble: unknown): boolean {
  return (trouble as { code?: number } | null)?.code === DUPLICATE_KEY;
}

/** Truong tien trong cac DTO, gui len dang chuoi so nguyen dong. */
const MONEY_FIELDS = new Set(['price', 'priceDelta']);

/**
 * Chep cac o duoc gui len vao ban ghi, doi o tien sang so thap phan chinh xac.
 * O khong gui thi giu nguyen, de mot lan sua khong xoa mat gia tri dang co.
 */
function applyGiven(target: { set: (path: string, value: unknown) => unknown }, patch: object): void {
  for (const [name, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    target.set(name, MONEY_FIELDS.has(name) ? Types.Decimal128.fromString(String(value)) : value);
  }
}

/**
 * Quan tri danh muc san pham va vat lieu (muc 12, 13): loai san pham va kich
 * co, de, hop va khung. Moi lan doi deu tra ve truoc va sau de ghi nhat ky.
 * Doi gia o day khong lam doi don da chot, vi dong don giu gia luc dat.
 */
@Injectable()
export class CatalogAdminService {
  constructor(
    @InjectModel(ProductType.name) private readonly productTypeModel: Model<ProductTypeDocument>,
    @InjectModel(DisplayBase.name) private readonly displayBaseModel: Model<DisplayBaseDocument>,
    @InjectModel(PackagingOption.name) private readonly packagingModel: Model<PackagingOptionDocument>,
  ) {}

  async createProductType(dto: CreateProductTypeDto): Promise<ProductTypeDocument> {
    return this.insert(() => this.productTypeModel.create({ ...dto, code: dto.code.toUpperCase(), sizes: [] }), 'Ma loai san pham nay da co roi');
  }

  async updateProductType(code: string, dto: UpdateProductTypeDto) {
    const one = await this.productType(code);
    return this.change(one, dto);
  }

  async addSize(code: string, dto: CreateProductSizeDto): Promise<ProductTypeDocument> {
    const one = await this.productType(code);
    const sizeCode = dto.code.toUpperCase();
    if (one.sizes.some((size) => size.code === sizeCode)) {
      throw new ConflictException('Ma kich co nay da co trong loai san pham');
    }
    one.sizes.push({
      ...dto,
      code: sizeCode,
      price: Types.Decimal128.fromString(dto.price),
      currency: 'VND',
    } as never);
    return one.save();
  }

  async updateSize(code: string, sizeCode: string, dto: UpdateProductSizeDto) {
    const one = await this.productType(code);
    const size = one.sizes.find((item) => item.code === sizeCode.toUpperCase());
    if (!size) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const before = { ...(size as unknown as Document).toObject() };
    applyGiven(size as unknown as Document, dto);
    await one.save();
    return { before, after: size, parent: one };
  }

  listDisplayBase() {
    return this.displayBaseModel.find().sort({ sortOrder: 1 }).exec();
  }

  async createDisplayBase(dto: CreateDisplayBaseDto): Promise<DisplayBaseDocument> {
    return this.insert(
      () =>
        this.displayBaseModel.create({
          ...dto,
          code: dto.code.toUpperCase(),
          priceDelta: Types.Decimal128.fromString(dto.priceDelta),
        }),
      'Ma de nay da co roi',
    );
  }

  async updateDisplayBase(code: string, dto: UpdateDisplayBaseDto) {
    const one = await this.displayBaseModel.findOne({ code: code.toUpperCase() }).exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return this.change(one, dto);
  }

  listPackaging(enabledOnly: boolean, kind?: PackagingKind) {
    const where: Record<string, unknown> = {};
    if (enabledOnly) {
      where.enabled = true;
    }
    if (kind && Object.values(PackagingKind).includes(kind)) {
      where.kind = kind;
    }
    return this.packagingModel.find(where).sort({ kind: 1, sortOrder: 1 }).exec();
  }

  async createPackaging(dto: CreatePackagingDto): Promise<PackagingOptionDocument> {
    return this.insert(
      () =>
        this.packagingModel.create({
          ...dto,
          code: dto.code.toUpperCase(),
          priceDelta: Types.Decimal128.fromString(dto.priceDelta),
        }),
      'Ma hop hoac khung nay da co roi',
    );
  }

  async updatePackaging(code: string, dto: UpdatePackagingDto) {
    const one = await this.packagingModel.findOne({ code: code.toUpperCase() }).exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return this.change(one, dto);
  }

  private async productType(code: string): Promise<ProductTypeDocument> {
    const one = await this.productTypeModel.findOne({ code: code.toUpperCase() }).exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return one;
  }

  private async change<T extends Document>(one: T, dto: object): Promise<{ before: Record<string, unknown>; after: T }> {
    const before = one.toObject() as Record<string, unknown>;
    applyGiven(one, dto);
    const after = await one.save();
    return { before, after };
  }

  private async insert<T>(make: () => Promise<T>, duplicate: string): Promise<T> {
    try {
      return await make();
    } catch (trouble) {
      if (isDuplicate(trouble)) {
        throw new ConflictException(duplicate);
      }
      throw trouble;
    }
  }
}
