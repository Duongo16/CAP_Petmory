import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CartDocument = HydratedDocument<Cart>;

@Schema({ _id: true })
export class CartItem {
  _id!: Types.ObjectId;

  @Prop({ required: true, uppercase: true, trim: true })
  productTypeCode!: string;

  @Prop({ required: true, uppercase: true, trim: true })
  sizeCode!: string;

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ trim: true, default: '' })
  petName!: string;

  /** The stand chosen for this line. Empty means no stand. */
  @Prop({ uppercase: true, trim: true, default: '' })
  displayBaseCode!: string;

  @Prop({ trim: true, default: '' })
  displayBaseName!: string;

  /** The attached design, so the workshop knows which model to make. May be empty. */
  @Prop({ type: Types.ObjectId, ref: 'Design', default: null })
  designId!: Types.ObjectId | null;

  @Prop({ type: Number, required: true, min: 1, max: 99 })
  quantity!: number;

  /**
   * Unit price frozen when the line was added, stored as an exact decimal.
   * A later price change by the Manager does not alter an existing cart.
   */
  @Prop({ type: Types.Decimal128, required: true })
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
