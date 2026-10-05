import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { CreateOrderDto } from './dto/order.dto';
import { CartService } from '../cart/cart.service';
import { CartItem, LineKind } from '../cart/schemas/cart.schema';
import { GoodsService } from '../goods/goods.service';
import { BusinessConfigService } from '../business-config/business-config.service';
import { DesignsService } from '../designs/designs.service';
import { PhotosService } from '../photos/photos.service';
import { AuditService } from '../../common/audit.service';
import { MSG } from '../../common/constants/messages';

const RESOURCE_TYPE = 'Order';
const PREFIX_REFERENCE = 'PM';

/** Ma co so du lieu tra ve khi mot chi muc duy nhat da co nguoi chiem. */
const DUPLICATE_KEY = 11000;

/** So lan thu lai khi ma don vua sinh ra da co nguoi dung. */
const CODE_ATTEMPTS = 5;

/** Bo dem so thu tu don theo tung ngay. */
const COUNTER_COLLECTION = 'order_counters';

const MSG_STALE = 'Don vua duoc cap nhat o noi khac, hay tai lai roi thu lai';

/** Mot dong cua don truoc khi ghi, gia va ten da duoc chot tu may chu. */
type OrderRow = Record<string, unknown> & {
  kind: LineKind;
  displayName: string;
  goodsCode: string;
  sku: string;
  quantity: number;
  unitPrice: Types.Decimal128;
  productionDays: number;
};

function isDuplicate(trouble: unknown): boolean {
  return (trouble as { code?: number } | null)?.code === DUPLICATE_KEY;
}

/**
 * The legal status transitions. A status is never set freely, and every move
 * must follow one of the edges declared here.
 *
 * Cancelling stays open all the way to delivery, because a piece can still be
 * dropped, damaged or refused while it is being checked or carried. Once it is
 * in the customer's hands the order is closed and only completion is left. A
 * refund after that is handled outside the system.
 */
const TRANSITION_VALID: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.AWAITING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
  [OrderStatus.IN_PRODUCTION]: [OrderStatus.SHIPPING, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * Don chi gom hang co san thi khong qua xuong: hang da nam san trong kho, chi
 * can dong goi roi giao. Tu da thanh toan, don nay duoc di thang sang dang giao.
 */
const TRANSITION_READY_MADE: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PAID]: [OrderStatus.SHIPPING, OrderStatus.CANCELLED],
};

/** True khi moi dong cua don deu la hang co san. */
function onlyReadyMade(order: { rows: { kind: LineKind }[] }): boolean {
  return order.rows.length > 0 && order.rows.every((one) => one.kind === LineKind.READY_MADE);
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly model: Model<OrderDocument>,
    private readonly cart: CartService,
    private readonly goods: GoodsService,
    private readonly config: BusinessConfigService,
    private readonly audit: AuditService,
    private readonly designs: DesignsService,
    private readonly photos: PhotosService,
  ) {}

  /**
   * Tao don tu gio hang hien tai.
   *
   * Gio duoc lay ra va lam trong trong cung mot buoc, nen bam dat hai lan chi
   * ra mot don. Hang co san duoc kiem lai ngay luc nay: con ban, con du kho,
   * va gia lay theo gia hien hanh chu khong theo gia luc cho vao gio. Khong dat
   * duoc thi gio duoc tra lai nguyen ven.
   */
  async createFromCart(customer: string, dto: CreateOrderDto): Promise<OrderDocument> {
    const claimed = await this.cart.claimItems(customer, dto.itemIds);
    if (claimed.length === 0) {
      throw new BadRequestException('Gio hang dang trong');
    }
    let order: OrderDocument;
    try {
      order = await this.writeOrder(customer, dto, claimed);
    } catch (trouble) {
      await this.cart.restoreItems(customer, claimed);
      throw trouble;
    }
    await this.audit.write({
      actor: customer,
      action: 'ORDER_CREATED',
      resourceType: RESOURCE_TYPE,
      resourceId: order.orderCode,
      after: { status: order.status, total: order.total.toString() },
    });
    return order;
  }

  private async writeOrder(
    customer: string,
    dto: CreateOrderDto,
    items: CartItem[],
  ): Promise<OrderDocument> {
    const rows = await this.rowsOf(items, customer);
    let total = 0n;
    let productionDays = 1;
    for (const row of rows) {
      total += BigInt(row.unitPrice.toString().split('.')[0]) * BigInt(row.quantity);
      productionDays = Math.max(productionDays, row.productionDays);
    }

    const config = await this.config.get();
    const now = new Date();
    const deliveryDate = new Date(now);
    deliveryDate.setDate(deliveryDate.getDate() + productionDays + config.estimatedShippingDays);
    const paymentDeadline = new Date(now);
    paymentDeadline.setHours(paymentDeadline.getHours() + config.qrExpiryHours);

    for (let attempt = 1; ; attempt += 1) {
      const orderCode = await this.generateOrderCode();
      try {
        return await this.model.create({
          orderCode,
          reference: orderCode,
          customer: new Types.ObjectId(customer),
          rows,
          delivery: { ...dto, note: dto.note ?? '' },
          total: Types.Decimal128.fromString(total.toString()),
          currency: items[0]?.currency ?? 'VND',
          status: OrderStatus.AWAITING_PAYMENT,
          productionDays,
          estimatedDelivery: deliveryDate,
          paymentDeadline,
        });
      } catch (trouble) {
        // Ma don trung voi mot don da co thi lay so ke tiep, chi trong vai lan.
        if (!isDuplicate(trouble) || attempt >= CODE_ATTEMPTS) {
          throw trouble;
        }
      }
    }
  }

  /**
   * Chot tung dong cua don.
   *
   * Ten, gia va ma hang duoc chep cung vao dong ngay luc dat; doi gia hay doi
   * ten sau do khong lam doi mot don da chot. Rieng hang co san thi duoc doc
   * lai tu danh muc ngay luc nay, va dong nao khong con ban duoc thi ca don
   * bi tu choi kem ten mon de khach biet phai sua gi.
   */
  private async rowsOf(items: CartItem[], customer: string): Promise<OrderRow[]> {
    const rows: OrderRow[] = [];
    const problems: string[] = [];
    for (const m of items) {
      const designId = m.designId ? new Types.ObjectId(m.designId.toString()) : null;
      const row: OrderRow = {
        kind: m.kind ?? LineKind.MADE_TO_ORDER,
        goodsCode: m.goodsCode ?? '',
        sku: m.sku ?? '',
        productTypeCode: m.productTypeCode,
        sizeCode: m.sizeCode,
        displayName: m.displayName,
        petName: m.petName,
        displayBaseCode: m.displayBaseCode ?? '',
        displayBaseName: m.displayBaseName ?? '',
        accessories: (m.accessories ?? []).map((one) => ({
          code: one.code,
          displayName: one.displayName,
          priceDelta: Types.Decimal128.fromString(one.priceDelta.toString()),
        })),
        designId,
        design: await this.copyDesign(designId, customer),
        quantity: m.quantity,
        unitPrice: Types.Decimal128.fromString(m.unitPrice.toString()),
        productionDays: m.productionDays,
      };
      if (row.kind === LineKind.READY_MADE) {
        const trouble = await this.checkReadyMade(row);
        if (trouble) {
          problems.push(trouble);
        }
      }
      rows.push(row);
    }
    if (problems.length > 0) {
      throw new ConflictException(problems.join('; '));
    }
    return rows;
  }

  /** Doc lai mot dong hang co san tu danh muc va cap nhat gia, hoac noi vi sao khong dat duoc. */
  private async checkReadyMade(row: OrderRow): Promise<string | null> {
    try {
      const found = await this.goods.findVariant(row.goodsCode, row.sku);
      if (found.variant.stock < row.quantity) {
        return found.variant.stock > 0
          ? `${row.displayName}: chi con ${found.variant.stock} mon trong kho`
          : `${row.displayName}: da het hang`;
      }
      row.unitPrice = found.variant.price;
      row.productionDays = found.goods.deliveryDays;
      return null;
    } catch (trouble) {
      if (trouble instanceof NotFoundException) {
        return `${row.displayName}: da ngung ban`;
      }
      throw trouble;
    }
  }

  /**
   * Copies a design into the order, rather than pointing at it.
   *
   * The copy is taken when the order is written, not when the money arrives.
   * What the customer agreed to is what the checkout page showed them, and
   * that is the design as it stood at this moment. Taking the copy later
   * would leave a window in which an edit could change the order silently.
   *
   * A design that cannot be read is left out rather than stopping the order:
   * the line still carries its own name, size and price.
   */
  private async copyDesign(
    designId: Types.ObjectId | null,
    customer: string,
  ): Promise<Record<string, unknown> | null> {
    if (!designId) {
      return null;
    }
    try {
      const design = await this.designs.findOwned(designId.toString(), customer);
      const photos = design.pet
        ? await this.photos.listByPet(design.pet.toString(), customer)
        : [];
      return {
        modelCode: design.modelCode,
        paint: design.paint.map((one) => ({ mesh: one.mesh, color: one.color })),
        colorCodesUsed: [...design.colorCodesUsed],
        zonePaint: design.zonePaint.map((one) => ({
          zone: one.zone,
          colorCode: one.colorCode,
        })),
        engraving: {
          name: design.engraving?.name ?? '',
          memorialDate: design.engraving?.memorialDate ?? null,
          message: design.engraving?.message ?? '',
        },
        stand: {
          baseCode: design.stand?.baseCode ?? '',
          tone: design.stand?.tone,
          decorations: [...(design.stand?.decorations ?? [])],
        },
        preview: design.preview.map((one) => ({ angle: one.angle, fileName: one.fileName })),
        pet: design.pet,
        petPhoto: photos.filter((one) => !one.isHidden).map((one) => one._id),
        featureNote: design.featureNote ?? '',
        takenAt: new Date(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Tich hoac bo tich mot muc tren phieu kiem tra chat luong.
   *
   * Ghi lai ai tich va luc nao, vi day la buoc cuoi truoc khi hang roi xuong
   * va la cho duy nhat noi duoc ai da nhin qua mon do.
   */
  async setQualityTick(
    orderCode: string,
    at: number,
    done: boolean,
    actor: string,
  ): Promise<OrderDocument> {
    const order = await this.model.findOne({ orderCode: orderCode.toUpperCase() }).exec();
    if (!order) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    if (at < 0 || at >= order.qualityCheck.length) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    if (order.status !== OrderStatus.IN_PRODUCTION) {
      throw new BadRequestException('Chi sua duoc phieu khi don dang lam');
    }

    const tick = order.qualityCheck[at];
    tick.done = done;
    tick.doneBy = done ? new Types.ObjectId(actor) : null;
    tick.doneAt = done ? new Date() : null;
    order.markModified('qualityCheck');
    await order.save();

    await this.audit.write({
      actor,
      action: 'ORDER_QUALITY_TICK',
      resourceType: RESOURCE_TYPE,
      resourceId: order.orderCode,
      after: { label: tick.label, done },
    });
    return order;
  }

  listMine(customer: string) {
    return this.model
      .find({ customer: new Types.ObjectId(customer) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Checks ownership on the order itself, not just the caller's role. */
  async findOwned(orderCode: string, customer: string): Promise<OrderDocument> {
    const order = await this.model.findOne({ orderCode: orderCode.toUpperCase() }).exec();
    if (!order || order.customer.toString() !== customer) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return order;
  }

  findByReference(reference: string) {
    return this.model.findOne({ reference: reference.toUpperCase() }).exec();
  }

  /** The statuses still reachable from where this order stands. */
  nextSteps(order: { status: OrderStatus; rows: { kind: LineKind }[] }): OrderStatus[] {
    const shortcut = onlyReadyMade(order) ? TRANSITION_READY_MADE[order.status] : undefined;
    return [...(shortcut ?? TRANSITION_VALID[order.status])];
  }

  /**
   * Khach tu huy mot don cua minh.
   *
   * Chi duoc khi don con dang cho thanh toan. Tien da vao roi thi viec huy
   * phai qua nguoi cua cua hang, vi con phai hoan tien.
   */
  async cancelMine(orderCode: string, customer: string): Promise<OrderDocument> {
    const order = await this.findOwned(orderCode, customer);
    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException('Chi huy duoc don dang cho thanh toan');
    }
    return this.transitionStatus(order, OrderStatus.CANCELLED, customer, 'Khach tu huy don');
  }

  /** Bo co can xu ly sau khi nhan vien da xu ly xong, ghi lai ai bo va ghi chu gi. */
  async clearAttention(order: OrderDocument, actor: string, note: string): Promise<void> {
    if (!order.needsAttention) {
      return;
    }
    await this.model.updateOne({ _id: order._id }, { $set: { needsAttention: false } }).exec();
    await this.audit.write({
      actor,
      action: 'ORDER_ATTENTION_CLEARED',
      resourceType: RESOURCE_TYPE,
      resourceId: order.orderCode,
      reason: note,
      before: { attentionNote: order.attentionNote },
    });
  }

  /** Danh dau mot don can nguoi that xu ly, kem ly do. */
  async flagForAttention(order: OrderDocument, note: string): Promise<void> {
    await this.model
      .updateOne({ _id: order._id }, { $set: { needsAttention: true, attentionNote: note } })
      .exec();
    await this.audit.write({
      actor: null,
      action: 'ORDER_FLAGGED',
      resourceType: RESOURCE_TYPE,
      resourceId: order.orderCode,
      reason: note,
    });
  }

  /**
   * Moves the status along a declared edge and writes an audit entry.
   *
   * The move itself is one conditional write that only succeeds while the
   * order still stands where it was read. Two people pressing the same button
   * together, or a bank notice arriving while staff confirm by hand, therefore
   * end with one move and one refusal, and stock is touched once.
   */
  async transitionStatus(
    order: OrderDocument,
    next: OrderStatus,
    actor: string | null,
    reason = '',
  ): Promise<OrderDocument> {
    const old = order.status;
    if (!this.nextSteps(order).includes(next)) {
      throw new BadRequestException(`Khong the chuyen tu ${old} sang ${next}`);
    }

    const change: Record<string, unknown> = { status: next };

    /*
     * Buoc vao khau lam thi lap phieu kiem dinh, neu chua co. Phieu duoc chep tu
     * tham so nghiep vu ngay luc nay, va tu do khong doi theo tham so nua.
     */
    if (next === OrderStatus.IN_PRODUCTION && order.qualityCheck.length === 0) {
      const config = await this.config.get();
      change['qualityCheck'] = config.qcChecklist.map((label) => ({
        label,
        done: false,
        doneBy: null,
        doneAt: null,
      }));
    }

    /*
     * Khong giao hang khi con muc chua tich. Muc dich cua phieu la chan hang loi
     * di tiep, nen phai chan that chu khong chi de ghi lai. Don hang co san di
     * thang tu da thanh toan sang giao thi khong co phieu nao de tich.
     */
    if (next === OrderStatus.SHIPPING && old === OrderStatus.IN_PRODUCTION) {
      const left = order.qualityCheck.filter((one) => !one.done).length;
      if (left > 0) {
        throw new BadRequestException(
          `Con ${left} muc kiem tra chat luong chua tich, chua the chuyen sang dang giao`,
        );
      }
    }

    if (next === OrderStatus.PAID) {
      change['paidAt'] = new Date();
    }
    if (next === OrderStatus.CANCELLED) {
      change['reasonDestroy'] = reason;
    }

    const moved = await this.model
      .findOneAndUpdate({ _id: order._id, status: old }, { $set: change }, { new: true })
      .exec();
    if (!moved) {
      throw new ConflictException(MSG_STALE);
    }

    if (next === OrderStatus.PAID) {
      await this.takeStockFor(moved);
    }
    if (next === OrderStatus.CANCELLED) {
      await this.giveBackStockFor(moved);
    }

    await this.audit.write({
      actor,
      action: 'ORDER_STATUS_CHANGED',
      resourceType: RESOURCE_TYPE,
      resourceId: moved.orderCode,
      before: { status: old },
      after: { status: next },
      reason,
    });
    return (await this.model.findById(moved._id).exec()) ?? moved;
  }

  /**
   * Tru kho cho cac dong hang co san khi don da thanh toan.
   *
   * Tien da vao tai khoan roi, nen mot dong khong tru duoc kho khong duoc
   * phep lam hong ca don. Thay vao do don duoc danh dau de nhom Cham soc
   * khach hang lien lac voi khach, dung nhu muc 23 khoan 10 yeu cau.
   */
  private async takeStockFor(order: OrderDocument): Promise<void> {
    // Danh dau da tru truoc, trong mot buoc co dieu kien, de khong lan nao tru hai lan.
    const claimed = await this.model
      .findOneAndUpdate({ _id: order._id, stockTaken: false }, { $set: { stockTaken: true } })
      .exec();
    if (!claimed) {
      return;
    }
    const short: string[] = [];
    for (const line of order.rows) {
      if (line.kind !== LineKind.READY_MADE || !line.goodsCode) {
        continue;
      }
      const done = await this.goods.takeStock(
        line.goodsCode,
        line.sku,
        line.quantity,
        order.orderCode,
      );
      if (!done) {
        short.push(`${line.displayName} (${line.sku})`);
      }
    }
    if (short.length > 0) {
      await this.flagForAttention(
        order,
        'Khong con du hang trong kho cho: ' + short.join(', ') +
          '. Can lien lac voi khach de hoan tien hoac doi mon.',
      );
    }
  }

  /** Tra hang ve kho khi don bi huy, neu truoc do da tru, va chi tra mot lan. */
  private async giveBackStockFor(order: OrderDocument): Promise<void> {
    const claimed = await this.model
      .findOneAndUpdate({ _id: order._id, stockTaken: true }, { $set: { stockTaken: false } })
      .exec();
    if (!claimed) {
      return;
    }
    const lost: string[] = [];
    for (const line of order.rows) {
      if (line.kind !== LineKind.READY_MADE || !line.goodsCode) {
        continue;
      }
      const back = await this.goods.giveBackStock(
        line.goodsCode,
        line.sku,
        line.quantity,
        order.orderCode,
      );
      if (!back) {
        lost.push(`${line.displayName} (${line.sku})`);
      }
    }
    if (lost.length > 0) {
      await this.flagForAttention(
        order,
        'Khong tra duoc hang ve kho vi to hop khong con trong danh muc: ' + lost.join(', ') +
          '. Can nhap lai bang tay.',
      );
    }
  }

  /**
   * The order code is a prefix, the date, and a per-day sequence number.
   * It carries no accents or spaces, so it fits in a bank transfer message.
   *
   * The number comes from a per-day counter that is raised in one write, so two
   * orders placed together never get the same number. The counter is first
   * lifted to at least the number of orders already made today, which keeps it
   * clear of codes written before the counter existed.
   */
  private async generateOrderCode(): Promise<string> {
    const now = new Date();
    const part =
      now.getFullYear().toString().slice(2) +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const madeToday = await this.model.countDocuments({ createdAt: { $gte: startOfDay } });
    const counters = this.model.db.collection<{ _id: string; seq: number }>(COUNTER_COLLECTION);
    try {
      await counters.updateOne({ _id: part }, { $max: { seq: madeToday } }, { upsert: true });
    } catch (trouble) {
      // Hai lan tao bo dem cung luc: lan thua bi tu choi, bo dem van da co.
      if (!isDuplicate(trouble)) {
        throw trouble;
      }
    }
    const raised = await counters.findOneAndUpdate(
      { _id: part },
      { $inc: { seq: 1 } },
      { returnDocument: 'after' },
    );
    const sequence = raised?.seq ?? madeToday + 1;
    return `${PREFIX_REFERENCE}${part}${sequence.toString().padStart(3, '0')}`;
  }
}
