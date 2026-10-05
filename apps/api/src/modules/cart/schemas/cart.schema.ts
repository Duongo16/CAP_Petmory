import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

export type CartDocument = HydratedDocument<Cart>;

/**
 * Hai dong hang cua cua hang.
 *
 * Hang tuy bien lam theo anh cua be va di qua xuong. Hang co san nhap ve ban,
 * khong gan voi be nao va khong qua xuong. Chung di chung mot gio va chung
 * mot don, nhung moi thu khac deu khac nhau nen phai phan biet duoc.
 */
export enum LineKind {
  MADE_TO_ORDER = 'MADE_TO_ORDER',
  READY_MADE = 'READY_MADE',
}

/** Mot phu kien tren dong hang, chot ten va gia luc chon. */
@Schema({ _id: false })
export class AccessoryLine {
  @Prop({ required: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ type: MongooseSchema.Types.Decimal128, required: true })
  priceDelta!: Types.Decimal128;
}

export const AccessoryLineSchema = SchemaFactory.createForClass(AccessoryLine);

@Schema({ _id: true })
export class CartItem {
  _id!: Types.ObjectId;

  @Prop({ type: String, enum: LineKind, default: LineKind.MADE_TO_ORDER, index: true })
  kind!: LineKind;

  @Prop({ uppercase: true, trim: true, default: '' })
  productTypeCode!: string;

  @Prop({ uppercase: true, trim: true, default: '' })
  sizeCode!: string;

  /** Ma mon hang co san. Rong voi dong hang tuy bien. */
  @Prop({ uppercase: true, trim: true, default: '' })
  goodsCode!: string;

  /** Ma to hop bien the. Rong voi dong hang tuy bien. */
  @Prop({ uppercase: true, trim: true, default: '' })
  sku!: string;

  /** Anh dai dien cua mon hang co san, de gio hang ve duoc ngay. */
  @Prop({ trim: true, default: '' })
  imageUrl!: string;

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ trim: true, default: '' })
  petName!: string;

  /** The stand chosen for this line. Empty means no stand. */
  @Prop({ uppercase: true, trim: true, default: '' })
  displayBaseCode!: string;

  @Prop({ trim: true, default: '' })
  displayBaseName!: string;

  /** Phu kien gan len mau, chot ten va gia luc them vao gio. */
  @Prop({ type: [AccessoryLineSchema], default: [] })
  accessories!: AccessoryLine[];

  /** The attached design, so the workshop knows which model to make. May be empty. */
  @Prop({ type: Types.ObjectId, ref: 'Design', default: null })
  designId!: Types.ObjectId | null;

  @Prop({ type: Number, required: true, min: 1, max: 99 })
  quantity!: number;

  /**
   * Unit price frozen when the line was added, stored as an exact decimal.
   * A later price change by the Manager does not alter an existing cart.
   */
  @Prop({ type: MongooseSchema.Types.Decimal128, required: true })
  unitPrice!: Types.Decimal128;

  @Prop({ required: true, default: 'VND', uppercase: true, trim: true })
  currency!: string;

  @Prop({ type: Number, required: true, min: 1 })
  productionDays!: number;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);

@Schema({ timestamps: true, collection: 'carts' })
export class Cart {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ type: [CartItemSchema], default: [] })
  items!: CartItem[];
}

export const CartSchema = SchemaFactory.createForClass(Cart);
