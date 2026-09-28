import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentNotificationDocument = HydratedDocument<PaymentNotification>;

/** Result of matching one notification against an order. */
export enum ReconcileResult {
  MATCHED = 'MATCHED',
  NO_REFERENCE = 'NO_REFERENCE',
  UNDERPAID = 'UNDERPAID',
  ALREADY_PROCESSED = 'ALREADY_PROCESSED',
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

  /** The payload exactly as received, kept for reconciliation and disputes. */
  @Prop({ type: Object, required: true })
  rawData!: Record<string, unknown>;
}

export const PaymentNotificationSchema = SchemaFactory.createForClass(PaymentNotification);
