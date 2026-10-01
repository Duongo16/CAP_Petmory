import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { Cart, CartDocument, LineKind } from './schemas/cart.schema';
import { AddGoodsDto, AddToCartDto } from './dto/cart.dto';
import { CatalogService } from '../catalog/catalog.service';
import { DesignsService } from '../designs/designs.service';
import { GoodsService } from '../goods/goods.service';
import { MSG } from '../../common/constants/messages';

export interface CartView {
  items: unknown[];
  countItem: number;
  total: string;
  currency: string;
  productionDaysMax: number;
}

/**
 * Adds a stand's price to a size price. Both are exact decimals and the system
 * only ever deals in whole dong, so the sum is done on integers and never on a
 * floating point number.
 */
/** The code the database answers with when a unique index is already taken. */
const DUPLICATE_KEY = 11000;

/** True when the failure is the database refusing a second row for one owner. */
function isDuplicate(trouble: unknown): boolean {
  return (trouble as { code?: number } | null)?.code === DUPLICATE_KEY;
}

function addMoney(price: Types.Decimal128, delta?: Types.Decimal128 | null): Types.Decimal128 {
  const total =
    BigInt(price.toString().split('.')[0]) +
    BigInt((delta ?? Types.Decimal128.fromString('0')).toString().split('.')[0]);
  return Types.Decimal128.fromString(total.toString());
}

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly model: Model<CartDocument>,
    private readonly catalog: CatalogService,
    private readonly designs: DesignsService,
    private readonly goods: GoodsService,
  ) {}

  async get(owner: string): Promise<CartView> {
    const cart = await this.getOrCreate(owner);
    return this.format(cart);
  }

  async add(owner: string, dto: AddToCartDto): Promise<CartView> {
    // Gia va thoi gian lam deu lay tu may chu, khong tin so lieu do trinh duyet gui len.
    const kind = await this.catalog.detailProductType(dto.productTypeCode);
    const size = kind.sizes.find((s) => s.code === dto.sizeCode.toUpperCase() && s.enabled);
    if (!size) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }

    // Ban thiet ke phai thuoc ve chinh nguoi dang them, cua nguoi khac thi bi tu choi.
    const design = dto.designId
      ? await this.designs.findOwned(dto.designId, owner)
      : null;

    // The stand is looked up on the server too, so its price cannot be forged.
    const base = await this.catalog.findDisplayBase(dto.displayBaseCode);
    const unitPrice = addMoney(size.price, base?.priceDelta);

    const cart = await this.getOrCreate(owner);
    // Two lines merge only when the design and the stand match as well, because
    // either one makes it a different product at the same type and size.
    const designId = design ? design._id : null;
    const baseCode = base?.code ?? '';
    const existing = cart.items.find(
      (m) =>
        m.productTypeCode === kind.code &&
        m.sizeCode === size.code &&
        m.petName === (dto.petName ?? '') &&
        m.displayBaseCode === baseCode &&
        (m.designId?.toString() ?? '') === (designId?.toString() ?? ''),
    );

    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + dto.quantity);
    } else {
      cart.items.push({
        _id: new Types.ObjectId(),
        kind: LineKind.MADE_TO_ORDER,
        goodsCode: '',
        sku: '',
        imageUrl: '',
        productTypeCode: kind.code,
        sizeCode: size.code,
        displayName: `${kind.name} — ${size.displayName}`,
        petName: dto.petName ?? '',
        displayBaseCode: baseCode,
        displayBaseName: base?.displayName ?? '',
        designId,
        quantity: dto.quantity,
        unitPrice,
        currency: size.currency,
        productionDays: size.productionDays,
      });
    }

    await cart.save();
    return this.format(cart);
  }

  /**
   * Them mot mon hang co san vao gio.
   *
   * Ton kho khong bi tru o day: muc 23 khoan 7 ghi ro chi tru khi don da
   * thanh toan. O day chi chan viec them mot mon dang het hang vao gio, de
   * khach khong di den tan buoc tra tien roi moi biet.
   */
  async addGoods(owner: string, dto: AddGoodsDto): Promise<CartView> {
    const found = await this.goods.findVariant(dto.goodsCode, dto.sku);
    if (found.variant.stock <= 0) {
      throw new BadRequestException('Mon nay dang het hang');
    }

    const cart = await this.getOrCreate(owner);
    const already = cart.items.find(
      (one) =>
        one.kind === LineKind.READY_MADE &&
        one.goodsCode === found.goods.code &&
        one.sku === found.variant.sku,
    );

    /*
     * Khong cho dat qua so hang dang co trong kho. Day chi la mot loi nhac
     * som cho khach; cho chan that su van la luc tru kho o buoc thanh toan.
     */
    const wanted = (already?.quantity ?? 0) + dto.quantity;
    if (wanted > found.variant.stock) {
      throw new BadRequestException(`Chi con ${found.variant.stock} mon trong kho`);
    }

    if (already) {
      already.quantity = Math.min(99, wanted);
    } else {
      const label = found.variant.optionValues.filter(Boolean).join(' · ');
      cart.items.push({
        _id: new Types.ObjectId(),
        kind: LineKind.READY_MADE,
        productTypeCode: '',
        sizeCode: '',
        goodsCode: found.goods.code,
        sku: found.variant.sku,
        imageUrl: found.goods.images[0] ?? '',
        displayName: label ? `${found.goods.name} — ${label}` : found.goods.name,
        petName: '',
        displayBaseCode: '',
        displayBaseName: '',
        designId: null,
        quantity: dto.quantity,
        unitPrice: found.variant.price,
        currency: 'VND',
        productionDays: found.goods.deliveryDays,
      });
    }

    await cart.save();
    return this.format(cart);
  }

  async changeQuantity(owner: string, codeItem: string, quantity: number): Promise<CartView> {
    const cart = await this.getOrCreate(owner);
    const item = cart.items.find((m) => m._id.toString() === codeItem);
    if (!item) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    item.quantity = quantity;
    await cart.save();
    return this.format(cart);
  }

  async removeItem(owner: string, codeItem: string): Promise<CartView> {
    const cart = await this.getOrCreate(owner);
    const before = cart.items.length;
    cart.items = cart.items.filter((m) => m._id.toString() !== codeItem);
    if (cart.items.length === before) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    await cart.save();
    return this.format(cart);
  }

  async removeNone(owner: string): Promise<CartView> {
    const cart = await this.getOrCreate(owner);
    cart.items = [];
    await cart.save();
    return this.format(cart);
  }

  /**
   * The one basket belonging to this account, made on first use.
   *
   * A fresh page asks for the basket more than once at the same moment, so
   * looking first and then creating let both calls find nothing and both try
   * to write, and the second was refused by the database. The write itself now
   * decides: either it makes the row or it hands back the one already there.
   * The refusal is still caught, because two writes arriving together can each
   * be told the row is taken, and in that case the row is simply read back.
   */
  private async getOrCreate(owner: string): Promise<CartDocument> {
    const id = new Types.ObjectId(owner);
    try {
      return await this.model
        .findOneAndUpdate(
          { owner: id },
          { $setOnInsert: { owner: id, items: [] } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
        .exec();
    } catch (trouble) {
      if (!isDuplicate(trouble)) {
        throw trouble;
      }
      const made = await this.model.findOne({ owner: id }).exec();
      if (!made) {
        throw trouble;
      }
      return made;
    }
  }

  /**
   * Totals are summed as integer strings to avoid floating point drift.
   * Money in this system is always a whole number of dong.
   */
  private format(cart: CartDocument): CartView {
    let total = 0n;
    let maxDays = 0;
    for (const m of cart.items) {
      total += BigInt(m.unitPrice.toString().split('.')[0]) * BigInt(m.quantity);
      maxDays = Math.max(maxDays, m.productionDays);
    }
    return {
      items: cart.items.map((m) => ({
        id: m._id.toString(),
        kind: m.kind,
        goodsCode: m.goodsCode,
        sku: m.sku,
        imageUrl: m.imageUrl,
        productTypeCode: m.productTypeCode,
        sizeCode: m.sizeCode,
        displayName: m.displayName,
        petName: m.petName,
        displayBaseCode: m.displayBaseCode,
        displayBaseName: m.displayBaseName,
        designId: m.designId?.toString() ?? null,
        quantity: m.quantity,
        unitPrice: m.unitPrice.toString(),
        currency: m.currency,
        productionDays: m.productionDays,
      })),
      countItem: cart.items.reduce((t, m) => t + m.quantity, 0),
      total: total.toString(),
      currency: cart.items[0]?.currency ?? 'VND',
      productionDaysMax: maxDays,
    };
  }
}
