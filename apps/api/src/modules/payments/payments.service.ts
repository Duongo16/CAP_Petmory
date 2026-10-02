import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as QRCode from 'qrcode';
import {
  ReconcileResult,
  PaymentNotification,
  PaymentNotificationDocument,
} from './schemas/payment-notification.schema';
import { OrdersService } from '../orders/orders.service';
import { BusinessConfigService } from '../business-config/business-config.service';
import { OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { normalizeContent, buildQrString } from './vietqr';

export interface SePayNotification {
  id?: string | number;
  transferAmount?: number;
  content?: string;
  description?: string;
  gateway?: string;
  accountNumber?: string;
  transactionDate?: string;
  [other: string]: unknown;
}

export interface QrResult {
  orderCode: string;
  reference: string;
  amount: string;
  currency: string;
  transferMessage: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrImage: string;
  paymentDeadline: string;
  status: string;
}

/** Mongo raises this code when a unique index rejects a duplicate row. */
const DUPLICATE_KEY = 11000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(PaymentNotification.name)
    private readonly log: Model<PaymentNotificationDocument>,
    private readonly orders: OrdersService,
    private readonly config: BusinessConfigService,
  ) {}

  /** Generates a transfer QR code for an order belonging to the signed-in customer. */
  async getQrCode(orderCode: string, customer: string): Promise<QrResult> {
    const order = await this.orders.findOwned(orderCode, customer);
    const cf = await this.config.get();

    const amount = order.total.toString().split('.')[0];
    const content = normalizeContent(order.reference);

    const qrString = buildQrString({
      bankCode: cf.bankCode,
      accountNumber: cf.accountNumber,
      amount,
      content,
    });

    const qrImage = await QRCode.toDataURL(qrString, { width: 420, margin: 1 });

    return {
      orderCode: order.orderCode,
      reference: order.reference,
      amount,
      currency: order.currency,
      transferMessage: content,
      bankName: cf.bankName,
      accountNumber: cf.accountNumber,
      accountHolder: cf.accountHolder,
      qrImage,
      paymentDeadline: order.paymentDeadline.toISOString(),
      status: order.status,
    };
  }

  /**
   * Handles a bank transfer notification.
   *
   * The narrow scope is deliberate: there is no reconciliation machinery. A matching
   * reference plus the full product price moves the order on; too little money or no
   * reference is logged and nothing else happens. The system never guesses.
   */
  async receiveNotification(message: SePayNotification): Promise<{ result: ReconcileResult }> {
    const transactionId = String(message.id ?? '');
    const amount = String(message.transferAmount ?? 0);
    const content = String(message.content ?? message.description ?? '');

    const reference = this.findReference(content);
    const order = reference ? await this.orders.findByReference(reference) : null;

    let result = ReconcileResult.NO_REFERENCE;
    if (order) {
      const amountDue = BigInt(order.total.toString().split('.')[0]);
      result = BigInt(amount) >= amountDue ? ReconcileResult.MATCHED : ReconcileResult.UNDERPAID;
    }

    /*
     * The log row is written first and a duplicate is caught from the database,
     * rather than asking whether one exists and then writing. Two notifications
     * for the same transaction can arrive at the same instant, and only the one
     * that wins the unique index is allowed to move the order.
     */
    try {
      await this.log.create({
        transactionId,
        amount,
        transferMessage: content,
        detectedReference: reference ?? '',
        result,
        rawData: message as Record<string, unknown>,
      });
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY) {
        return { result: ReconcileResult.ALREADY_PROCESSED };
      }
      throw error;
    }

    if (order && order.status !== OrderStatus.AWAITING_PAYMENT) {
      // Don da huy hoac da tra roi: tien ve bao nhieu cung la tien phai xem lai de hoan.
      await this.flagLatePayment(order, transactionId, amount);
    } else if (result === ReconcileResult.MATCHED && order) {
      await this.settle(order, transactionId, amount);
    }

    return { result };
  }

  /**
   * Ghi nhan tien du cho mot don.
   *
   * Don dang cho tien thi chuyen sang da thanh toan. Don da huy, hoac da duoc
   * thanh toan bang mot giao dich khac, thi khong tu dong lam gi them, vi tien
   * da vao tai khoan va chi nguoi that moi quyet dinh duoc hoan hay giu. Don do
   * duoc danh dau de nhom Cham soc khach hang xu ly.
   */
  private async settle(order: OrderDocument, transactionId: string, amount: string): Promise<void> {
    if (order.status === OrderStatus.AWAITING_PAYMENT) {
      try {
        await this.orders.transitionStatus(order, OrderStatus.PAID, null, 'Nhan du tien');
        this.logger.log(`Don ${order.orderCode} da thanh toan`);
        return;
      } catch (trouble) {
        if (!(trouble instanceof ConflictException)) {
          throw trouble;
        }
      }
    }
    const now = (await this.orders.findByReference(order.reference)) ?? order;
    if (now.status === OrderStatus.PAID) {
      // Vua co nguoi xac nhan bang tay dung luc tien ve: day van la mot lan tra.
      return;
    }
    await this.flagLatePayment(now, transactionId, amount);
  }

  private async flagLatePayment(order: OrderDocument, transactionId: string, amount: string): Promise<void> {
    await this.orders.flagForAttention(
      order,
      `Nhan ${amount} qua giao dich ${transactionId} khi don dang o trang thai ${order.status}. ` +
        'Can kiem tra de hoan tien cho khach.',
    );
    this.logger.warn(`Don ${order.orderCode} nhan tien khi dang ${order.status}`);
  }

  listLog(limit = 50) {
    return this.log.find().sort({ createdAt: -1 }).limit(limit).exec();
  }

  /** Finds the reference inside the transfer message: PM followed by digits. */
  private findReference(content: string): string | null {
    const match = content.toUpperCase().match(/PM\d{9}/);
    return match ? match[0] : null;
  }
}
