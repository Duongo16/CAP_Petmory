import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { LineKind } from '../cart/schemas/cart.schema';
import { AiUsageService, UsageTotal } from '../ai/ai-usage.service';

/**
 * Cac trang thai duoc tinh vao doanh thu.
 *
 * Muc 22 khoan 2: chi tinh tu khi da thanh toan tro di. Don cho thanh toan
 * chua co tien that, con don da huy thi tien da tra lai, nen ca hai deu
 * khong duoc gop vao.
 */
const EARNED_STATES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.SHIPPING,
  OrderStatus.COMPLETED,
];

/** Trang thai duoc coi la hang da den tay khach, khong con tre duoc nua. */
const ARRIVED: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.CANCELLED];

/** Mot khoang thoi gian nguoi xem chon. */
export interface Period {
  from: Date;
  to: Date;
}

/** Doanh thu cua mot nhom, tinh bang dong chan. */
export interface MoneyRow {
  name: string;
  count: number;
  amount: string;
}

export interface DailyRevenueRow {
  date: string;
  orderCount: number;
  revenue: string;
}

export interface RevenueReport {
  from: string;
  to: string;
  orderCount: number;
  total: string;
  byKind: MoneyRow[];
  byProduct: MoneyRow[];
  daily: DailyRevenueRow[];
}

export interface AiCostReport {
  from: string;
  to: string;
  total: string;
  rows: UsageTotal[];
}

export interface ProgressReport {
  from: string;
  to: string;
  byStatus: { status: string; count: number }[];
  lateCount: number;
  late: { orderCode: string; status: string; estimatedDelivery: string }[];
}

/**
 * Ba bao cao quan tri: doanh thu, chi phi tri tue nhan tao, tien do san xuat.
 *
 * Moi phep cong tien o day deu lam tren so nguyen. Mot dong hang gia hai tram
 * nghin nhan ba, cong qua so thuc, se ra sau tram nghin le mot phan nghin, va
 * sai so do se lon dan theo so dong.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly usage: AiUsageService,
  ) {}

  /**
   * Doanh thu trong mot khoang, tach theo dong hang va theo tung san pham.
   *
   * Moc thoi gian lay theo luc tien ve, khong phai luc dat, vi mot don dat
   * cuoi thang va tra tien dau thang sau la doanh thu cua thang sau.
   */
  async revenue(period: Period): Promise<RevenueReport> {
    const orders = await this.orderModel
      .find({
        status: { $in: EARNED_STATES },
        paidAt: { $gte: period.from, $lte: period.to },
      })
      .select('rows total paidAt')
      .exec();

    let total = 0n;
    const byKind = new Map<string, { count: number; amount: bigint }>();
    const byProduct = new Map<string, { count: number; amount: bigint }>();
    const dailyMap = new Map<string, { count: number; amount: bigint }>();

    for (const order of orders) {
      let orderTotal = 0n;
      for (const line of order.rows) {
        const money = asWholeDong(line.unitPrice.toString()) * BigInt(line.quantity);
        total += money;
        orderTotal += money;
        addTo(byKind, String(line.kind ?? LineKind.MADE_TO_ORDER), line.quantity, money);
        addTo(byProduct, nameOfLine(line), line.quantity, money);
      }
      if (order.paidAt) {
        const d = order.paidAt.toISOString().slice(0, 10);
        const cur = dailyMap.get(d) ?? { count: 0, amount: 0n };
        cur.count += 1;
        cur.amount += orderTotal;
        dailyMap.set(d, cur);
      }
    }

    const daily: DailyRevenueRow[] = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, val]) => ({
        date,
        orderCount: val.count,
        revenue: val.amount.toString(),
      }));

    return {
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      orderCount: orders.length,
      total: total.toString(),
      byKind: asRows(byKind),
      byProduct: asRows(byProduct),
      daily,
    };
  }

  /** Chi phi tri tue nhan tao, cong tu don gia da ghi vao tung luot dung. */
  async aiCost(period: Period): Promise<AiCostReport> {
    const rows = await this.usage.totals(period);
    const total = rows.reduce((sum, one) => sum + BigInt(one.cost), 0n);
    return {
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      total: total.toString(),
      rows,
    };
  }

  /**
   * Tien do san xuat: so don o tung trang thai, va cac don da tre han.
   *
   * Tre han nghia la da qua ngay giao du kien ma hang chua den tay khach. Don
   * da huy khong tinh la tre, vi khong con gi de giao nua.
   */
  async progress(period: Period): Promise<ProgressReport> {
    const grouped = await this.orderModel.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: period.from, $lte: period.to } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const lateRows = await this.orderModel
      .find({
        createdAt: { $gte: period.from, $lte: period.to },
        estimatedDelivery: { $lt: new Date() },
        status: { $nin: ARRIVED },
      })
      .select('orderCode status estimatedDelivery')
      .sort({ estimatedDelivery: 1 })
      .limit(200)
      .exec();

    const countOf = new Map(grouped.map((one) => [one._id, one.count]));
    return {
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      byStatus: Object.values(OrderStatus).map((status) => ({
        status,
        count: countOf.get(status) ?? 0,
      })),
      lateCount: lateRows.length,
      late: lateRows.map((one) => ({
        orderCode: one.orderCode,
        status: one.status,
        estimatedDelivery: one.estimatedDelivery.toISOString(),
      })),
    };
  }
}

/** Cong mot dong vao mot nhom cua bang tong. */
function addTo(
  into: Map<string, { count: number; amount: bigint }>,
  name: string,
  quantity: number,
  money: bigint,
): void {
  const already = into.get(name) ?? { count: 0, amount: 0n };
  already.count += quantity;
  already.amount += money;
  into.set(name, already);
}

/** Doi bang tong sang dang tra ve, sap theo so tien giam dan. */
function asRows(from: Map<string, { count: number; amount: bigint }>): MoneyRow[] {
  return [...from]
    .map(([name, one]) => ({ name, count: one.count, amount: one.amount.toString() }))
    .sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1));
}

/**
 * Ten dung de gom mot dong hang lai.
 *
 * Hang co san gom theo ma hang, hang tuy bien gom theo ma loai san pham. Hai
 * dong hang co hai he ma rieng nen khong bao gio dung lan vao nhau.
 */
function nameOfLine(line: { kind?: string; goodsCode?: string; productTypeCode?: string }): string {
  if (line.kind === LineKind.READY_MADE) {
    return line.goodsCode || 'READY_MADE';
  }
  return line.productTypeCode || 'MADE_TO_ORDER';
}

/**
 * Phan nguyen cua mot so tien.
 *
 * He thong chi tinh bang dong chan. Cat phan le o day thay vi lam tron, vi
 * lam tron se tao ra tien khong co that trong bao cao.
 */
function asWholeDong(raw: string): bigint {
  return BigInt(raw.split('.')[0] || '0');
}
