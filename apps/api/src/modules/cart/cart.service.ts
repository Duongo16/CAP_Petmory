import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { AddToCartDto } from './dto/cart.dto';
import { CatalogService } from '../catalog/catalog.service';
import { DesignsService } from '../designs/designs.service';
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
  ) {}

  async get(owner: string): Promise<CartView> {
    const cart = await this.getOrCreate(owner);
    return this.format(cart);
  }

  async add(owner: string, dto: AddToCartDto): Promise<CartView> {
        // Price and lead time always come from the server; numbers sent by the browser are ignored.
    const kind = await this.catalog.detailProductType(dto.productTypeCode);
    const size = kind.sizes.find((s) => s.code === dto.sizeCode.toUpperCase() && s.enabled);
    if (!size) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }

    // The design must belong to the person adding it; another user's id is rejected.
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

  private async getOrCreate(owner: string): Promise<CartDocument> {
    const id = new Types.ObjectId(owner);
    const existing = await this.model.findOne({ owner: id }).exec();
    return existing ?? this.model.create({ owner: id, items: [] });
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
