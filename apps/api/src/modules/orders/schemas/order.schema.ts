import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

/** Order status. Only moves along the edges declared in the service. */
export enum OrderStatus {
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAYMENT_EXPIRED = 'PAYMENT_EXPIRED',
  PAID = 'PAID',
  IN_PRODUCTION = 'IN_PRODUCTION',
  QUALITY_CHECK = 'QUALITY_CHECK',
  READY_TO_SHIP = 'READY_TO_SHIP',
  SHIPPING = 'SHIPPING',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Schema({ _id: false })
export class OrderLine {
  @Prop({ required: true, uppercase: true, trim: true })
  productTypeCode!: string;

  @Prop({ required: true, uppercase: true, trim: true })
  sizeCode!: string;

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ trim: true, default: '' })
  petName!: string;

  /** The stand chosen at order time, frozen with the rest of the line. */
  @Prop({ uppercase: true, trim: true, default: '' })
  displayBaseCode!: string;

  @Prop({ trim: true, default: '' })
  displayBaseName!: string;

  /** The design frozen at order time, so the workshop makes what the customer approved. */
  @Prop({ type: Types.ObjectId, ref: 'Design', default: null })
  designId!: Types.ObjectId | null;

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;

  /** Unit price frozen at order time; later config changes do not affect it. */
  @Prop({ type: Types.Decimal128, required: true })
  unitPrice!: Types.Decimal128;

  @Prop({ type: Number, required: true, min: 1 })
  productionDays!: number;
}

export const OrderLineSchema = SchemaFactory.createForClass(OrderLine);

@Schema({ _id: false })
export class DeliveryInfo {
  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ required: true, trim: true })
  phone!: string;

  @Prop({ required: true, trim: true })
  address!: string;

  @Prop({ required: true, trim: true })
  province!: string;

  @Prop({ trim: true, default: '' })
  note!: string;
}

export const DeliveryInfoSchema = SchemaFactory.createForClass(DeliveryInfo);

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  /** The order code shown to the customer, and the basis of the transfer reference. */
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  orderCode!: string;

  /** The unique string placed in the transfer message for automatic matching. */
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  reference!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customer!: Types.ObjectId;

  @Prop({ type: [OrderLineSchema], required: true })
  rows!: OrderLine[];

  @Prop({ type: DeliveryInfoSchema, required: true })
  delivery!: DeliveryInfo;

  /** Goods total. Excludes shipping, which the carrier collects on delivery. */
  @Prop({ type: Types.Decimal128, required: true })
  total!: Types.Decimal128;

  @Prop({ required: true, default: 'VND', uppercase: true, trim: true })
  currency!: string;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.AWAITING_PAYMENT, index: true })
  status!: OrderStatus;

  @Prop({ type: Number, required: true, min: 1 })
  productionDays!: number;

  @Prop({ type: Date, required: true })
  estimatedDelivery!: Date;

  @Prop({ type: Date, required: true })
  paymentDeadline!: Date;

  @Prop({ type: Date, default: null })
  paidAt!: Date | null;

  @Prop({ trim: true, default: '' })
  reasonDestroy!: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
