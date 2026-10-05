import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as QRCode from 'qrcode';
import {
  NotificationSource,
  ReconcileResult,
  PaymentNotification,
  PaymentNotificationDocument,
} from './schemas/payment-notification.schema';
import { OrdersService } from '../orders/orders.service';
import { BusinessConfigService } from '../business-config/business-config.service';
import { OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { normalizeContent, buildQrString } from './vietqr';
import { SePayNotificationDto } from './dto/sepay-notification.dto';
import { candidateReferences, wholeDong } from './reference';
import { SePayClient, SePayTransaction } from './sepay-client';
import { AuditService } from '../../common/audit.service';

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
  /** Da qua han thanh toan ma don van dang cho tien. */
  expired: boolean;
  status: string;
}

/** Ket qua tra cho SePay: SePay chi coi la thanh cong khi co success bang true. */
export interface WebhookAnswer {
  success: true;
  result: ReconcileResult;
}

/** Tom tat mot lan doi soat voi SePay. */
export interface ReconcileSummary {
  sinceDate: string;
  fetched: number;
  alreadyKnown: number;
  added: number;
  skipped: number;
  byResult: Partial<Record<ReconcileResult, number>>;
}

/** Mongo raises this code when a unique index rejects a duplicate row. */
const DUPLICATE_KEY = 11000;

/** Doi soat lay toi da bay nhieu ngay, va mac dinh bao nhieu ngay. */
const RECONCILE_DAYS_MAX = 7;
const RECONCILE_DAYS_DEFAULT = 2;

/** Gio Viet Nam, de ngay doi soat khop voi ngay giao dich ben SePay. */
const VN_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

const RESOURCE_TYPE = 'Payment';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(PaymentNotification.name)
    private readonly log: Model<PaymentNotificationDocument>,
    private readonly orders: OrdersService,
    private readonly config: BusinessConfigService,
    private readonly sepay: SePayClient,
    private readonly audit: AuditService,
  ) {}

  /** Generates a transfer QR code for an order belonging to the signed-in customer. */
  async getQrCode(orderCode: string, customer: string): Promise<QrResult> {
    const order = await this.orders.findOwned(orderCode, customer);
    const cf = await this.config.get();

    const amount = order.total.toString().split('.')[0];
    const content = normalizeContent(order.reference);
    // QR doc tai khoan da chot trong don; don cu chua chot thi dung cau hinh hien tai.
    const payee = order.payee?.accountNumber ? order.payee : cf;

    const qrString = buildQrString({
      bankCode: payee.bankCode,
      accountNumber: payee.accountNumber,
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
      bankName: payee.bankName,
      accountNumber: payee.accountNumber,
      accountHolder: payee.accountHolder,
      qrImage,
      paymentDeadline: order.paymentDeadline.toISOString(),
      expired: order.status === OrderStatus.AWAITING_PAYMENT && order.paymentDeadline.getTime() < Date.now(),
      status: order.status,
    };
  }

  /**
   * Nhan mot giao dich SePay bao qua webhook.
   *
   * Phan than giao dich duoc kiem tay o day thay vi qua bo kiem chung cua he
   * thong, vi bo kiem chung tu choi moi truong la ma SePay co the them truong
   * moi bat ky luc nao. Tu choi mot giao dich that chi vi mot truong la thi
   * tien da vao ma don khong bao gio duoc ghi nhan.
   */
  async receiveNotification(raw: Record<string, unknown>): Promise<WebhookAnswer> {
    const dto = await this.parse(raw);
    const result = await this.process(dto, raw, NotificationSource.WEBHOOK);
    return { success: true, result };
  }

  /**
   * Doi soat voi SePay: lay giao dich tien vao cua tai khoan nhan tien trong vai
   * ngay gan nhat va xu ly nhung giao dich webhook da bo lo.
   *
   * Giao dich nao da co trong nhat ky thi bi chan boi chi muc duy nhat, nen
   * chay doi soat bao nhieu lan cung khong ghi nhan tien hai lan.
   */
  async reconcile(days: number | undefined, actor: string): Promise<ReconcileSummary> {
    const span = Math.min(Math.max(days ?? RECONCILE_DAYS_DEFAULT, 1), RECONCILE_DAYS_MAX);
    const sinceDate = VN_DAY.format(new Date(Date.now() - (span - 1) * 24 * 60 * 60 * 1000));
    const cf = await this.config.get();
    const transactions = await this.sepay.listTransactions(cf.accountNumber, sinceDate);

    const summary: ReconcileSummary = { sinceDate, fetched: transactions.length, alreadyKnown: 0, added: 0, skipped: 0, byResult: {} };
    for (const one of transactions) {
      const amountIn = wholeDong(one.amount_in);
      if (amountIn === null || amountIn === 0n) {
        // Giao dich tien ra, hoac so tien doc khong ra: khong lien quan toi don.
        summary.skipped += 1;
        continue;
      }
      const raw = this.fromTransaction(one, amountIn);
      const dto = await this.parse(raw).catch(() => null);
      if (!dto) {
        summary.skipped += 1;
        continue;
      }
      const result = await this.process(dto, raw, NotificationSource.RECONCILE);
      if (result === ReconcileResult.ALREADY_PROCESSED) {
        summary.alreadyKnown += 1;
      } else {
        summary.added += 1;
        summary.byResult[result] = (summary.byResult[result] ?? 0) + 1;
      }
    }

    await this.audit.write({
      actor,
      action: 'PAYMENT_RECONCILED',
      resourceType: RESOURCE_TYPE,
      resourceId: sinceDate,
      after: summary as unknown as Record<string, unknown>,
    });
    return summary;
  }

  listLog(limit = 50) {
    const take = Math.min(Math.max(Number.isFinite(limit) ? limit : 50, 1), 500);
    return this.log.find().sort({ createdAt: -1 }).limit(take).exec();
  }

  private async parse(raw: Record<string, unknown>): Promise<SePayNotificationDto> {
    const dto = plainToInstance(SePayNotificationDto, raw);
    const errors = await validate(dto, { whitelist: false, forbidUnknownValues: false });
    if (errors.length > 0) {
      const first = Object.values(errors[0].constraints ?? {})[0] ?? 'Du lieu giao dich khong hop le';
      throw new BadRequestException(first);
    }
    return dto;
  }

  /**
   * Xu ly mot giao dich da kiem, du den tu webhook hay tu doi soat.
   *
   * Dong nhat ky duoc ghi truoc va trung lap bi bat tu co so du lieu, thay vi
   * hoi co chua roi moi ghi. Hai lan bao cung mot giao dich co the toi cung mot
   * luc, va chi lan thang chi muc duy nhat moi duoc dong toi don.
   */
  private async process(
    dto: SePayNotificationDto,
    raw: Record<string, unknown>,
    source: NotificationSource,
  ): Promise<ReconcileResult> {
    const cf = await this.config.get();
    const content = dto.content ?? dto.description ?? '';
    const amount = BigInt(dto.transferAmount);
    const candidates = candidateReferences(content, dto.code);

    let order: OrderDocument | null = null;
    let reference = candidates[0] ?? '';
    let result: ReconcileResult;

    if (dto.transferType !== 'out') {
      for (const code of candidates) {
        const found = await this.orders.findByReference(code);
        if (found) {
          order = found;
          reference = code;
          break;
        }
      }
    }
    // Tien phai vao tai khoan hien tai, hoac tai khoan da chot trong chinh don do.
    const accepted = new Set([cf.accountNumber, order?.payee?.accountNumber].filter(Boolean));
    const otherAccount =
      Boolean(dto.accountNumber) && !accepted.has(dto.accountNumber ?? '') && !accepted.has(dto.subAccount ?? '');
    if (dto.transferType === 'out' || otherAccount) {
      result = ReconcileResult.IGNORED;
      order = null;
    } else {
      result = order ? this.classify(order, amount) : ReconcileResult.NO_REFERENCE;
    }

    try {
      await this.log.create({
        transactionId: dto.id,
        amount: amount.toString(),
        transferMessage: content,
        detectedReference: reference,
        result,
        source,
        gateway: dto.gateway ?? '',
        accountNumber: dto.accountNumber ?? '',
        referenceCode: dto.referenceCode ?? '',
        transactionDate: dto.transactionDate ?? '',
        rawData: raw,
      });
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY) {
        return ReconcileResult.ALREADY_PROCESSED;
      }
      throw error;
    }

    if (order) {
      await this.act(order, result, dto.id, amount);
    }
    return result;
  }

  /** So tien so voi so phai tra, khi don con dang cho tien. */
  private classify(order: OrderDocument, amount: bigint): ReconcileResult {
    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      return ReconcileResult.LATE;
    }
    const due = BigInt(order.total.toString().split('.')[0]);
    if (amount === due) {
      return ReconcileResult.MATCHED;
    }
    return amount > due ? ReconcileResult.OVERPAID : ReconcileResult.UNDERPAID;
  }

  /**
   * Viec phai lam voi don sau khi da ghi nhat ky.
   *
   * He thong khong tu doan: du tien thi chuyen don, con moi truong hop lech
   * (thieu, du, ve tre) deu danh dau de nguoi that lien he khach.
   */
  private async act(order: OrderDocument, result: ReconcileResult, transactionId: string, amount: bigint): Promise<void> {
    const due = BigInt(order.total.toString().split('.')[0]);
    switch (result) {
      case ReconcileResult.MATCHED:
        await this.settle(order, transactionId, amount);
        return;
      case ReconcileResult.OVERPAID:
        if (await this.settle(order, transactionId, amount)) {
          await this.orders.flagForAttention(
            order,
            `Khach chuyen du: nhan ${amount} qua giao dich ${transactionId}, don can ${due}. ` +
              `Can hoan ${amount - due} cho khach.`,
          );
        }
        return;
      case ReconcileResult.UNDERPAID:
        await this.orders.flagForAttention(
          order,
          `Khach chuyen thieu: nhan ${amount} qua giao dich ${transactionId}, don can ${due}. ` +
            'Don van cho thanh toan. Lien he khach de chuyen bu hoac hoan lai.',
        );
        return;
      case ReconcileResult.LATE:
        await this.flagLatePayment(order, transactionId, amount);
        return;
      default:
        return;
    }
  }

  /**
   * Chuyen don sang da thanh toan. Tra ve true khi chinh giao dich nay da chuyen duoc.
   *
   * Neu don vua bi doi trang thai boi mot giao dich khac hay nguoi xac nhan bang
   * tay dung luc nay, giao dich nay tro thanh tien ve tre: ghi lai ket qua cho
   * dung va danh dau don, vi co the khach vua tra hai lan.
   */
  private async settle(order: OrderDocument, transactionId: string, amount: bigint): Promise<boolean> {
    try {
      await this.orders.transitionStatus(order, OrderStatus.PAID, null, `Nhan du tien qua giao dich ${transactionId}`);
      this.logger.log(`Don ${order.orderCode} da thanh toan`);
      return true;
    } catch (trouble) {
      if (!(trouble instanceof ConflictException)) {
        throw trouble;
      }
    }
    await this.log.updateOne({ transactionId }, { $set: { result: ReconcileResult.LATE } }).exec();
    const now = (await this.orders.findByReference(order.reference)) ?? order;
    await this.flagLatePayment(now, transactionId, amount);
    return false;
  }

  private async flagLatePayment(order: OrderDocument, transactionId: string, amount: bigint): Promise<void> {
    await this.orders.flagForAttention(
      order,
      `Nhan ${amount} qua giao dich ${transactionId} khi don dang o trang thai ${order.status}. ` +
        'Can kiem tra de hoan tien cho khach.',
    );
    this.logger.warn(`Don ${order.orderCode} nhan tien khi dang ${order.status}`);
  }

  /** Doi mot giao dich trong API doi soat sang cung dang voi giao dich webhook. */
  private fromTransaction(one: SePayTransaction, amountIn: bigint): Record<string, unknown> {
    return {
      id: one.id,
      gateway: one.bank_brand_name,
      transactionDate: one.transaction_date,
      accountNumber: one.account_number,
      subAccount: one.sub_account ?? '',
      code: one.code ?? '',
      content: one.transaction_content,
      transferType: 'in',
      transferAmount: Number(amountIn),
      referenceCode: one.reference_number,
    };
  }
}
