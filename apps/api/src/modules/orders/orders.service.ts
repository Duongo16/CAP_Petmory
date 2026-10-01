import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { CreateOrderDto } from './dto/order.dto';
import { CartService } from '../cart/cart.service';
import { LineKind } from '../cart/schemas/cart.schema';
import { GoodsService } from '../goods/goods.service';
import { BusinessConfigService } from '../business-config/business-config.service';
import { DesignsService } from '../designs/designs.service';
import { PhotosService } from '../photos/photos.service';
import { AuditService } from '../../common/audit.service';
import { MSG } from '../../common/constants/messages';

const RESOURCE_TYPE = 'Order';
const PREFIX_REFERENCE = 'PM';

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

  /** Creates an order from the current cart, then empties the cart. */
  async createFromCart(customer: string, dto: CreateOrderDto): Promise<OrderDocument> {
    const cart = await this.cart.get(customer);
    if (cart.items.length === 0) {
      throw new BadRequestException('Gio hang dang trong');
    }

    const config = await this.config.get();
    const now = new Date();
    const orderCode = await this.generateOrderCode();

    const deliveryDate = new Date(now);
    deliveryDate.setDate(
      deliveryDate.getDate() + cart.productionDaysMax + config.estimatedShippingDays,
    );

    const paymentDeadline = new Date(now);
    paymentDeadline.setHours(paymentDeadline.getHours() + config.qrExpiryHours);

    const rows = [];
    for (const m of cart.items as Record<string, unknown>[]) {
      const designId = m.designId ? new Types.ObjectId(m.designId as string) : null;
      rows.push({
        /*
         * Ten, gia va ma hang deu duoc chot cung vao dong ngay luc dat. Doi
         * gia hay doi ten sau do khong duoc phep lam doi mot don da chot.
         */
        kind: (m.kind as LineKind) ?? LineKind.MADE_TO_ORDER,
        goodsCode: (m.goodsCode as string) ?? '',
        sku: (m.sku as string) ?? '',
        productTypeCode: m.productTypeCode as string,
        sizeCode: m.sizeCode as string,
        displayName: m.displayName as string,
        petName: m.petName as string,
        displayBaseCode: (m.displayBaseCode as string) ?? '',
        displayBaseName: (m.displayBaseName as string) ?? '',
        designId,
        design: await this.copyDesign(designId, customer),
        quantity: m.quantity as number,
        unitPrice: Types.Decimal128.fromString(m.unitPrice as string),
        productionDays: m.productionDays as number,
      });
    }

    const order = await this.model.create({
      orderCode,
      reference: orderCode,
      customer: new Types.ObjectId(customer),
      rows,
      delivery: { ...dto, note: dto.note ?? '' },
      total: Types.Decimal128.fromString(cart.total),
      currency: cart.currency,
      status: OrderStatus.AWAITING_PAYMENT,
      productionDays: cart.productionDaysMax,
      estimatedDelivery: deliveryDate,
      paymentDeadline,
    });

    await this.cart.removeNone(customer);
    await this.audit.write({
      actor: customer,
      action: 'ORDER_CREATED',
      resourceType: RESOURCE_TYPE,
      resourceId: order.orderCode,
      after: { status: order.status, total: order.total.toString() },
    });

    return order;
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
        preview: design.preview.map((one) => ({ angle: one.angle, fileName: one.fileName })),
        pet: design.pet,
        petPhoto: photos.filter((one) => !one.isHidden).map((one) => one._id),
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

  /** The statuses still reachable from the current one. */
  nextSteps(current: OrderStatus): OrderStatus[] {
    return [...TRANSITION_VALID[current]];
  }

  /** Moves the status along a declared edge and writes an audit entry. */
  async transitionStatus(
    order: OrderDocument,
    next: OrderStatus,
    actor: string | null,
    reason = '',
  ): Promise<OrderDocument> {
    const old = order.status;
    if (!TRANSITION_VALID[old].includes(next)) {
      throw new BadRequestException(`Khong the chuyen tu ${old} sang ${next}`);
    }

    /*
     * Buoc vao khau lam thi lap phieu kiem dinh, neu chua co. Phieu duoc chep tu
     * tham so nghiep vu ngay luc nay, va tu do khong doi theo tham so nua.
     */
    if (next === OrderStatus.IN_PRODUCTION && order.qualityCheck.length === 0) {
      const config = await this.config.get();
      order.qualityCheck = config.qcChecklist.map((label) => ({
        label,
        done: false,
        doneBy: null,
        doneAt: null,
      }));
    }

    /*
     * Khong giao hang khi con muc chua tich. Muc dich cua phieu la
     * chan hang loi di tiep, nen phai chan that chu khong chi de ghi lai.
     */
    if (next === OrderStatus.SHIPPING) {
      const left = order.qualityCheck.filter((one) => !one.done).length;
      if (left > 0) {
        throw new BadRequestException(
          `Con ${left} muc kiem tra chat luong chua tich, chua the chuyen sang dang giao`,
        );
      }
    }

    order.status = next;
    if (next === OrderStatus.PAID) {
      order.paidAt = new Date();
      await this.takeStockFor(order);
    }
    if (next === OrderStatus.CANCELLED) {
      order.reasonDestroy = reason;
      await this.giveBackStockFor(order);
    }
    await order.save();

    await this.audit.write({
      actor,
      action: 'ORDER_STATUS_CHANGED',
      resourceType: RESOURCE_TYPE,
      resourceId: order.orderCode,
      before: { status: old },
      after: { status: next },
      reason,
    });
    return order;
  }

  /**
   * Tru kho cho cac dong hang co san khi don da thanh toan.
   *
   * Tien da vao tai khoan roi, nen mot dong khong tru duoc kho khong duoc
   * phep lam hong ca don. Thay vao do don duoc danh dau de nhom Cham soc
   * khach hang lien lac voi khach, dung nhu muc 23 khoan 10 yeu cau.
   */
  private async takeStockFor(order: OrderDocument): Promise<void> {
    if (order.stockTaken) {
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
    order.stockTaken = true;
    if (short.length > 0) {
      order.needsAttention = true;
      order.attentionNote =
        'Khong con du hang trong kho cho: ' + short.join(', ') +
        '. Can lien lac voi khach de hoan tien hoac doi mon.';
    }
  }

  /** Tra hang ve kho khi don bi huy, neu truoc do da tru. */
  private async giveBackStockFor(order: OrderDocument): Promise<void> {
    if (!order.stockTaken) {
      return;
    }
    for (const line of order.rows) {
      if (line.kind !== LineKind.READY_MADE || !line.goodsCode) {
        continue;
      }
      await this.goods.giveBackStock(
        line.goodsCode,
        line.sku,
        line.quantity,
        order.orderCode,
      );
    }
    order.stockTaken = false;
  }

  /**
   * The order code is a prefix, the date, and a per-day sequence number.
   * It carries no accents or spaces, so it fits in a bank transfer message.
   */
  private async generateOrderCode(): Promise<string> {
    const now = new Date();
    const part =
      now.getFullYear().toString().slice(2) +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dailySequence = await this.model.countDocuments({ createdAt: { $gte: startOfDay } });
    return `${PREFIX_REFERENCE}${part}${(dailySequence + 1).toString().padStart(3, '0')}`;
  }
}
