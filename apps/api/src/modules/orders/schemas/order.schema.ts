import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { AccessoryLine, AccessoryLineSchema, LineKind, PackagingLine, PackagingLineSchema } from '../../cart/schemas/cart.schema';
import {
  EngravingSchema,
  MeshPaintSchema,
  PreviewImageSchema,
  StandSchema,
  ZonePaintSchema,
  type Engraving,
  type MeshPaint,
  type Preview,
  type Stand,
  type ZonePaint,
} from '../../designs/schemas/design.schema';

export type OrderDocument = HydratedDocument<Order>;

/** Order status. Only moves along the edges declared in the service. */
export enum OrderStatus {
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAID = 'PAID',
  IN_PRODUCTION = 'IN_PRODUCTION',
  SHIPPING = 'SHIPPING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * The design as it stood at the moment of payment.
 *
 * This is a copy, not a link. The design it was copied from may be edited or
 * removed afterwards and this copy stays exactly as it was.
 */
@Schema({ _id: false })
export class DesignSnapshot {
  @Prop({ required: true, trim: true })
  modelCode!: string;

  @Prop({ type: [MeshPaintSchema], default: [] })
  paint!: MeshPaint[];

  /** The wool colour codes used, so the workshop knows which rolls to pull. */
  @Prop({ type: [String], default: [] })
  colorCodesUsed!: string[];

  /**
   * Mau cua tung vung co ten, chep nguyen tu ban thiet ke luc dat hang.
   *
   * Ho so san xuat doc day de ghi ma mau theo vung. Rong voi don cu va voi
   * mo hinh chua tach du vung, va luc do ho so quay ve liet ke chung.
   */
  @Prop({ type: [ZonePaintSchema], default: [] })
  zonePaint!: ZonePaint[];

  @Prop({ type: EngravingSchema, default: () => ({}) })
  engraving!: Engraving;

  /** Mau go va do trang tri cua de, de xuong lam dung. */
  @Prop({ type: StandSchema, default: () => ({}) })
  stand!: Stand;

  /** The six preview pictures, kept by file name in the picture store. */
  @Prop({ type: [PreviewImageSchema], default: [] })
  preview!: Preview[];

  /** The pet the design was made for, if one was attached. */
  @Prop({ type: Types.ObjectId, ref: 'Pet', default: null })
  pet!: Types.ObjectId | null;

  /** The pet photographs the workshop should work from. */
  @Prop({ type: [Types.ObjectId], ref: 'PetPhoto', default: [] })
  petPhoto!: Types.ObjectId[];

  /** Dac diem rieng cua be khach ghi trong ban thiet ke. */
  @Prop({ trim: true, default: '' })
  featureNote!: string;

  @Prop({ type: Date, required: true })
  takenAt!: Date;
}

export const DesignSnapshotSchema = SchemaFactory.createForClass(DesignSnapshot);

/** Mot muc tren phieu kiem tra chat luong, va ai da tich no. */
@Schema({ _id: false })
export class QualityTick {
  @Prop({ required: true, trim: true })
  label!: string;

  @Prop({ type: Boolean, default: false })
  done!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  doneBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  doneAt!: Date | null;
}

export const QualityTickSchema = SchemaFactory.createForClass(QualityTick);

@Schema({ _id: false })
export class OrderLine {
  /** Dong hang tuy bien hay dong hang co san. */
  @Prop({ type: String, enum: LineKind, default: LineKind.MADE_TO_ORDER, index: true })
  kind!: LineKind;

  @Prop({ uppercase: true, trim: true, default: '' })
  productTypeCode!: string;

  @Prop({ uppercase: true, trim: true, default: '' })
  sizeCode!: string;

  /** Ma mon hang co san, chot cung vao dong luc dat. Rong voi hang tuy bien. */
  @Prop({ uppercase: true, trim: true, default: '' })
  goodsCode!: string;

  @Prop({ uppercase: true, trim: true, default: '' })
  sku!: string;

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ trim: true, default: '' })
  petName!: string;

  /** The stand chosen at order time, frozen with the rest of the line. */
  @Prop({ uppercase: true, trim: true, default: '' })
  displayBaseCode!: string;

  @Prop({ trim: true, default: '' })
  displayBaseName!: string;

  /** Phu kien gan len mau, chot ten va gia cung voi dong. */
  @Prop({ type: [AccessoryLineSchema], default: [] })
  accessories!: AccessoryLine[];

  /** Hop va khung chot luc dat hang, cung voi gia luc do. */
  @Prop({ type: [PackagingLineSchema], default: [] })
  packaging!: PackagingLine[];

  /** Which design this line came from. Kept only so the two can be traced to each other. */
  @Prop({ type: Types.ObjectId, ref: 'Design', default: null })
  designId!: Types.ObjectId | null;

  /**
   * A copy of the design exactly as it stood when the order was placed.
   *
   * The line used to hold only the design's identifier. A customer who edited
   * the design afterwards changed what the workshop would make, without paying
   * for the change and without anyone being told. Since there is no separate
   * approval step, this copy is the only record of what was actually agreed,
   * so nothing may write to it once it exists.
   */
  @Prop({ type: DesignSnapshotSchema, default: null })
  design!: DesignSnapshot | null;

  @Prop({ type: Number, required: true, min: 1 })
  quantity!: number;

  /** Unit price frozen at order time; later config changes do not affect it. */
  @Prop({ type: MongooseSchema.Types.Decimal128, required: true })
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

/** Tai khoan nhan tien chot cung don. */
@Schema({ _id: false })
export class Payee {
  @Prop({ trim: true, default: '' })
  bankCode!: string;

  @Prop({ trim: true, default: '' })
  bankName!: string;

  @Prop({ trim: true, default: '' })
  accountNumber!: string;

  @Prop({ trim: true, default: '' })
  accountHolder!: string;
}

export const PayeeSchema = SchemaFactory.createForClass(Payee);

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  /** The order code shown to the customer, and the basis of the transfer reference. */
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  orderCode!: string;

  /** Tai khoan nhan tien chot luc dat; don cu chua co thi doc cau hinh hien tai. */
  @Prop({ type: PayeeSchema, default: null })
  payee!: Payee | null;

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
  @Prop({ type: MongooseSchema.Types.Decimal128, required: true })
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

  /**
   * Phieu kiem tra chat luong cua don nay.
   *
   * Duoc chep tu danh sach trong tham so nghiep vu vao luc don buoc vao khau
   * kiem dinh. Chep chu khong tro, vi doi danh sach o tham so khong duoc phep
   * lam doi phieu cua mot don dang lam do.
   */
  @Prop({ type: [QualityTickSchema], default: [] })
  qualityCheck!: QualityTick[];

  /**
   * Don nay dang can nguoi that xu ly.
   *
   * Dat len khi mot dong hang co san khong tru duoc kho luc thanh toan: tien
   * da nhan roi nen khong the tu choi don, nhung hang thi khong con. Nhom
   * Cham soc khach hang phai lien lac voi khach de hoan tien hoac doi mon.
   */
  @Prop({ type: Boolean, default: false, index: true })
  needsAttention!: boolean;

  @Prop({ trim: true, default: '' })
  attentionNote!: string;

  /** Ton kho cua don nay da duoc tru chua, de khong tru hai lan. */
  @Prop({ type: Boolean, default: false })
  stockTaken!: boolean;

  @Prop({ trim: true, default: '' })
  reasonDestroy!: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
