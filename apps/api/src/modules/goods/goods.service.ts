import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Goods, GoodsDocument, GoodsVariant } from './schemas/goods.schema';
import { GoodsCategory, GoodsCategoryDocument } from './schemas/goods-category.schema';
import { StockMove, StockMoveDocument, StockReason } from './schemas/stock-move.schema';
import { GoodsQueryDto } from './dto/goods.dto';
import { MSG } from '../../common/constants/messages';

/** Bao nhieu mon hang hien tren mot trang cua trang khach. */
const PAGE_SIZE = 12;

/** Mot to hop cu the cua mot mon hang, da tra ra day du. */
export interface FoundVariant {
  goods: GoodsDocument;
  variant: GoodsVariant;
}

/** Mot lan tru kho that bai, kem so luong con lai de nguoi truc doc duoc. */
export interface StockShort {
  goodsCode: string;
  sku: string;
  wanted: number;
}

/**
 * Hang co san: doc danh muc, tim to hop, va tru hoac hoan ton kho.
 *
 * Tru kho la phan can trong nhat o day. No phai la mot buoc duy nhat trong co
 * so du lieu, khong duoc doc ra roi ghi lai, vi hai don thanh toan cung luc
 * cho mon cuoi cung se cung doc thay con mot va cung tru di mot.
 */
@Injectable()
export class GoodsService {
  constructor(
    @InjectModel(Goods.name) private readonly model: Model<GoodsDocument>,
    @InjectModel(GoodsCategory.name)
    private readonly categoryModel: Model<GoodsCategoryDocument>,
    @InjectModel(StockMove.name) private readonly moveModel: Model<StockMoveDocument>,
  ) {}

  /** Cac nhom hang dang bat, theo thu tu Ben A da dat. */
  listCategory(all = false): Promise<GoodsCategoryDocument[]> {
    const where: Record<string, unknown> = { isHidden: false };
    if (!all) {
      where['enabled'] = true;
    }
    return this.categoryModel.find(where).sort({ sortOrder: 1, name: 1 }).exec();
  }

  /**
   * Mot trang cua danh muc hang, loc theo nhom va tim theo ten.
   *
   * Mon hang khong con to hop nao con hang van hien ra, nhung trang khach se
   * cho no cai nhan het hang: giau di thi khach tuong cua hang khong con ban
   * mon do nua, con hien ra thi ho biet de quay lai.
   */
  async list(query: GoodsQueryDto, all = false) {
    const where: Record<string, unknown> = { isHidden: false };
    if (!all) {
      where['enabled'] = true;
    }
    const word = query.keyword?.trim();
    if (word) {
      where['name'] = new RegExp(escapeWord(word), 'i');
    }
    if (query.category) {
      const group = await this.categoryModel
        .findOne({ code: query.category.toUpperCase(), isHidden: false })
        .exec();
      if (!group) {
        return { rows: [], total: 0, page: 1, pageCount: 1 };
      }
      where['category'] = group._id;
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const [rows, total] = await Promise.all([
      this.model
        .find(where)
        .sort(orderOf(query.sort))
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate('category', 'code name')
        .exec(),
      this.model.countDocuments(where).exec(),
    ]);

    return {
      rows,
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  /** Mot mon hang theo ma, kem nhom cua no. */
  async detail(code: string, all = false): Promise<GoodsDocument> {
    const where: Record<string, unknown> = { code: code.toUpperCase(), isHidden: false };
    if (!all) {
      where['enabled'] = true;
    }
    const one = await this.model.findOne(where).populate('category', 'code name').exec();
    if (!one) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return one;
  }

  /**
   * Tim mot to hop cu the.
   *
   * Gia va so ngay giao deu lay tu day, khong bao gio lay tu so lieu trinh
   * duyet gui len, vi khach hoan toan co the sua truoc khi gui.
   */
  async findVariant(goodsCode: string, sku: string, all = false): Promise<FoundVariant> {
    const goods = await this.detail(goodsCode, all);
    const variant = goods.variant.find((one) => one.sku === sku.toUpperCase());
    if (!variant || (!all && !variant.enabled)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return { goods, variant };
  }

  /**
   * Tru kho cho mot to hop, trong dung mot buoc.
   *
   * Dieu kien "con du hang" nam ngay trong cau lenh ghi, nen co so du lieu la
   * ben quyet dinh chu khong phai ma nguon. Hai don cung tru mon cuoi cung
   * thi mot don thanh cong va mot don nhan ve false, khong bao gio ca hai
   * cung thanh cong va khong bao gio ton kho xuong duoi khong.
   */
  async takeStock(
    goodsCode: string,
    sku: string,
    quantity: number,
    orderCode: string,
  ): Promise<boolean> {
    const code = goodsCode.toUpperCase();
    const skuCode = sku.toUpperCase();
    const done = await this.model
      .findOneAndUpdate(
        {
          code,
          isHidden: false,
          variant: { $elemMatch: { sku: skuCode, stock: { $gte: quantity } } },
        },
        // Moi lan doi ton cung nang phien ban, de mot lan sua mon hang dang mo do khong ghi de len.
        { $inc: { 'variant.$.stock': -quantity, __v: 1 } },
        { new: true },
      )
      .exec();
    if (!done) {
      return false;
    }
    const after = done.variant.find((one) => one.sku === skuCode)?.stock ?? 0;
    await this.writeMove({
      goods: done._id,
      sku: skuCode,
      delta: -quantity,
      before: after + quantity,
      after,
      reason: StockReason.ORDER_PAID,
      orderCode,
    });
    return true;
  }

  /**
   * Tra hang ve kho khi mot don bi huy.
   *
   * Tra ve false khi to hop khong con trong danh muc, de don do duoc danh dau
   * cho nguoi that dem hang ve kho bang tay.
   */
  async giveBackStock(
    goodsCode: string,
    sku: string,
    quantity: number,
    orderCode: string,
  ): Promise<boolean> {
    const code = goodsCode.toUpperCase();
    const skuCode = sku.toUpperCase();
    const done = await this.model
      .findOneAndUpdate(
        { code, isHidden: false, 'variant.sku': skuCode },
        { $inc: { 'variant.$.stock': quantity, __v: 1 } },
        { new: true },
      )
      .exec();
    if (!done) {
      return false;
    }
    const after = done.variant.find((one) => one.sku === skuCode)?.stock ?? 0;
    await this.writeMove({
      goods: done._id,
      sku: skuCode,
      delta: quantity,
      before: after - quantity,
      after,
      reason: StockReason.ORDER_CANCELLED,
      orderCode,
    });
    return true;
  }

  /** Lich su thay doi ton kho cua mot to hop, moi nhat truoc. */
  async movesOf(goodsCode: string, sku: string): Promise<StockMoveDocument[]> {
    const goods = await this.detail(goodsCode, true);
    return this.moveModel
      .find({ goods: goods._id, sku: sku.toUpperCase() })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('actor', 'fullName')
      .exec();
  }

  /**
   * Dieu chinh ton kho bang tay, kem ly do bat buoc.
   *
   * Ket qua khong bao gio duoc phep am: kho thuc te khong co so am, va mot so
   * am o day se lam moi phep doi soat sau nay sai theo.
   */
  async adjustStock(
    goodsCode: string,
    sku: string,
    delta: number,
    note: string,
    actor: string,
  ): Promise<GoodsDocument> {
    const code = goodsCode.toUpperCase();
    const skuCode = sku.toUpperCase();
    const match: Record<string, unknown> =
      delta < 0
        ? { code, isHidden: false, variant: { $elemMatch: { sku: skuCode, stock: { $gte: -delta } } } }
        : { code, isHidden: false, 'variant.sku': skuCode };

    const done = await this.model
      .findOneAndUpdate(match, { $inc: { 'variant.$.stock': delta, __v: 1 } }, { new: true })
      .exec();
    if (!done) {
      throw new BadRequestException('Khong du hang trong kho de tru di bang nay');
    }
    const after = done.variant.find((one) => one.sku === skuCode)?.stock ?? 0;
    await this.writeMove({
      goods: done._id,
      sku: skuCode,
      delta,
      before: after - delta,
      after,
      reason: StockReason.MANUAL,
      note,
      actor,
    });
    return done;
  }

  /**
   * Ghi so ton ban dau cua mot to hop vua tao.
   *
   * Hang nhap lan dau cung la mot lan ton kho thay doi, nen phai co dong trong
   * so; khong co thi doi soat se thay hang tu nhien xuat hien.
   */
  async recordOpening(goods: Types.ObjectId, sku: string, stock: number, actor: string): Promise<void> {
    if (stock <= 0) {
      return;
    }
    await this.writeMove({
      goods,
      sku: sku.toUpperCase(),
      delta: stock,
      before: 0,
      after: stock,
      reason: StockReason.MANUAL,
      note: 'Ton dau khi tao to hop',
      actor,
    });
  }

  /** Ghi mot dong vao so ton kho. So nay chi them, khong bao gio sua. */
  private async writeMove(input: {
    goods: Types.ObjectId;
    sku: string;
    delta: number;
    before: number;
    after: number;
    reason: StockReason;
    note?: string;
    actor?: string;
    orderCode?: string;
  }): Promise<void> {
    await this.moveModel.create({
      goods: input.goods,
      sku: input.sku,
      delta: input.delta,
      before: input.before,
      after: input.after,
      reason: input.reason,
      note: input.note ?? '',
      actor: input.actor ? new Types.ObjectId(input.actor) : null,
      orderCode: input.orderCode ?? '',
    });
  }
}

/** Thu tu sap xep cua trang khach, chon tu mot danh sach dong. */
function orderOf(sort?: string): Record<string, 1 | -1> {
  if (sort === 'PRICE_UP') {
    return { 'variant.0.price': 1 };
  }
  if (sort === 'PRICE_DOWN') {
    return { 'variant.0.price': -1 };
  }
  return { createdAt: -1 };
}

/** Bo tac dung cua cac ky tu dac biet khi nguoi dung go vao o tim kiem. */
function escapeWord(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
