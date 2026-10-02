import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { OrdersService } from '../orders/orders.service';
import { PetsService } from '../pets/pets.service';
import { OrderFilterDto, PAGE_SIZE_DEFAULT, CustomerSearchDto } from './dto/admin.dto';
import { MSG } from '../../common/constants/messages';
import { AuditService } from '../../common/audit.service';

/**
 * Escapes characters that carry special meaning inside a search expression.
 * A keyword typed by a user must never turn itself into a pattern.
 */
function escape(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const RESOURCE_TYPE_ORDER = 'Order';

export interface PageResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** One customer plus rolled-up figures, used by the list screen. */
export interface CustomerRow {
  _id: string;
  email: string;
  fullName: string;
  roles: string[];
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  countOrder: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly orders: OrdersService,
    private readonly pets: PetsService,
    private readonly audit: AuditService,
  ) {}

  /** Counts orders per status, used by the dispatch board. */
  async countByStatus(): Promise<Record<string, number>> {
    const group = await this.orderModel
      .aggregate<{ _id: OrderStatus; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();

    const result: Record<string, number> = {};
    for (const status of Object.values(OrderStatus)) {
      result[status] = 0;
    }
    for (const line of group) {
      result[line._id] = line.count;
    }
    return result;
  }

  async listOrder(filter: OrderFilterDto): Promise<PageResult<OrderDocument>> {
    const where: QueryFilter<OrderDocument> = {};
    if (filter.status) {
      where.status = filter.status;
    }
    const keyword = filter.keyword?.trim();
    if (keyword) {
      const color = new RegExp(escape(keyword), 'i');
      where.$or = [
        { orderCode: color },
        { 'delivery.fullName': color },
        { 'delivery.phone': color },
      ];
    }

    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? PAGE_SIZE_DEFAULT;
    const [rows, total] = await Promise.all([
      this.orderModel
        .find(where)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.orderModel.countDocuments(where).exec(),
    ]);

    return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }

  /** One order with its customer and the transitions still available from here. */
  async detailOrder(orderCode: string) {
    const order = await this.orderModel.findOne({ orderCode: orderCode.toUpperCase() }).exec();
    if (!order) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const [customer, history] = await Promise.all([
      this.userModel.findById(order.customer).exec(),
      this.audit.historyOfResource(RESOURCE_TYPE_ORDER, order.orderCode),
    ]);
    return {
      order,
      customer: customer ? this.slimCustomer(customer) : null,
      nextSteps: this.orders.nextSteps(order),
      history,
    };
  }

  async changeOrderStatus(
    orderCode: string,
    next: OrderStatus,
    actor: string,
    reason: string,
  ) {
    const order = await this.orderModel.findOne({ orderCode: orderCode.toUpperCase() }).exec();
    if (!order) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    await this.orders.transitionStatus(order, next, actor, reason);
    return this.detailOrder(orderCode);
  }

  /** Tich hoac bo tich mot muc tren phieu kiem tra chat luong cua don. */
  async setQualityTick(orderCode: string, at: number, done: boolean, actor: string) {
    await this.orders.setQualityTick(orderCode, at, done, actor);
    return this.detailOrder(orderCode);
  }

  async listCustomers(filter: CustomerSearchDto): Promise<PageResult<CustomerRow>> {
    const where: QueryFilter<UserDocument> = {};
    const keyword = filter.keyword?.trim();
    if (keyword) {
      const color = new RegExp(escape(keyword), 'i');
      where.$or = [{ email: color }, { fullName: color }];
    }

    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? PAGE_SIZE_DEFAULT;
    const [users, total] = await Promise.all([
      this.userModel
        .find(where)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.userModel.countDocuments(where).exec(),
    ]);

    const orderCountByCustomer = await this.countOrdersByCustomer(users.map((u) => u._id));
    const rows = users.map((u) => ({
      ...this.slimCustomer(u),
      countOrder: orderCountByCustomer[u._id.toString()] ?? 0,
    }));

    return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }

  /** One customer's profile with their pets and full order history. */
  async customerDetail(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const customer = await this.userModel.findById(id).exec();
    if (!customer) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const [pet, orders] = await Promise.all([
      this.pets.listByOwner(id),
      this.orderModel.find({ customer: customer._id }).sort({ createdAt: -1 }).exec(),
    ]);
    return { customer: this.slimCustomer(customer), pet, orders };
  }

  private async countOrdersByCustomer(codes: Types.ObjectId[]): Promise<Record<string, number>> {
    if (codes.length === 0) {
      return {};
    }
    const group = await this.orderModel
      .aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { customer: { $in: codes } } },
        { $group: { _id: '$customer', count: { $sum: 1 } } },
      ])
      .exec();
    const result: Record<string, number> = {};
    for (const line of group) {
      result[line._id.toString()] = line.count;
    }
    return result;
  }

  /** Returns only the fields the screen needs, never the whole user record. */
  private slimCustomer(u: UserDocument) {
    return {
      _id: u._id.toString(),
      email: u.email,
      fullName: u.fullName,
      roles: u.roles as unknown as string[],
      active: u.active,
      lastLoginAt: u.lastLoginAt,
      createdAt: (u as unknown as { createdAt: Date }).createdAt,
    };
  }
}
