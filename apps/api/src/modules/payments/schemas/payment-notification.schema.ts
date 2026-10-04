import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentNotificationDocument = HydratedDocument<PaymentNotification>;

/** Result of matching one notification against an order. */
export enum ReconcileResult {
  /** Dung so tien, don chuyen sang da thanh toan. */
  MATCHED = 'MATCHED',
  /** Du tien va du ra: don van sang da thanh toan, phan du duoc danh dau de hoan. */
  OVERPAID = 'OVERPAID',
  /** Thieu tien: don giu nguyen, duoc danh dau de lien he khach. */
  UNDERPAID = 'UNDERPAID',
  /** Tien ve khi don da huy hoac da tra: danh dau de xem hoan tien. */
  LATE = 'LATE',
  /** Khong tim thay ma don trong noi dung. */
  NO_REFERENCE = 'NO_REFERENCE',
  /** Tien ra, hoac tien vao tai khoan khac tai khoan nhan tien cua cua hang. */
  IGNORED = 'IGNORED',
  /** Giao dich da xu ly roi. Chi tra ve, khong luu. */
  ALREADY_PROCESSED = 'ALREADY_PROCESSED',
}

/** Giao dich den tu dau: SePay bao qua webhook, hay lay ve khi doi soat. */
export enum NotificationSource {
  WEBHOOK = 'WEBHOOK',
  RECONCILE = 'RECONCILE',
}

/**
 * Transfer notification log. Every notification received is recorded verbatim,
 * including ones matching no order, so support can check when a customer says they paid.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'payment_notifications' })
export class PaymentNotification {
  /** Transaction id issued by the payment service, used to block duplicate handling. */
  @Prop({ required: true, unique: true, trim: true, index: true })
  transactionId!: string;

  @Prop({ required: true, trim: true })
  amount!: string;

  @Prop({ trim: true, default: '' })
  transferMessage!: string;

  @Prop({ trim: true, default: '', index: true })
  detectedReference!: string;

  @Prop({ type: String, enum: ReconcileResult, required: true, index: true })
  result!: ReconcileResult;

  @Prop({ type: String, enum: NotificationSource, default: NotificationSource.WEBHOOK })
  source!: NotificationSource;

  /** Ngan hang, tai khoan nhan, ma tham chieu ngan hang va gio giao dich theo SePay. */
  @Prop({ trim: true, default: '' })
  gateway!: string;

  @Prop({ trim: true, default: '' })
  accountNumber!: string;

  @Prop({ trim: true, default: '' })
  referenceCode!: string;

  @Prop({ trim: true, default: '' })
  transactionDate!: string;

  /** The payload exactly as received, kept for reconciliation and disputes. */
  @Prop({ type: Object, required: true })
  rawData!: Record<string, unknown>;
}

export const PaymentNotificationSchema = SchemaFactory.createForClass(PaymentNotification);
