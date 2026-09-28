import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { CreateOrderDto } from './dto/order.dto';
import { CartService } from '../cart/cart.service';
import { BusinessConfigService } from '../business-config/business-config.service';
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
  [OrderStatus.AWAITING_PAYMENT]: [
    OrderStatus.PAID,
    OrderStatus.PAYMENT_EXPIRED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_EXPIRED]: [OrderStatus.AWAITING_PAYMENT, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
  [OrderStatus.IN_PRODUCTION]: [OrderStatus.QUALITY_CHECK, OrderStatus.CANCELLED],
  [OrderStatus.QUALITY_CHECK]: [
    OrderStatus.READY_TO_SHIP,
    OrderStatus.IN_PRODUCTION,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.READY_TO_SHIP]: [OrderStatus.SHIPPING, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPING]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly model: Model<OrderDocument>,
    private readonly cart: CartService,
    private readonly config: BusinessConfigService,
    private readonly audit: AuditService,
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

    const rows = (cart.items as Record<string, unknown>[]).map((m) => ({
      productTypeCode: m.productTypeCode as string,
      sizeCode: m.sizeCode as string,
      displayName: m.displayName as string,
      petName: m.petName as string,
      displayBaseCode: (m.displayBaseCode as string) ?? '',
      displayBaseName: (m.displayBaseName as string) ?? '',
      designId: m.designId ? new Types.ObjectId(m.designId as string) : null,
      quantity: m.quantity as number,
      unitPrice: Types.Decimal128.fromString(m.unitPrice as string),
      productionDays: m.productionDays as number,
    }));

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
    order.status = next;
    if (next === OrderStatus.PAID) {
      order.paidAt = new Date();
    }
    if (next === OrderStatus.CANCELLED) {
      order.reasonDestroy = reason;
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
