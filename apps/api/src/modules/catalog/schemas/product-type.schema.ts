import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

export type ProductTypeDocument = HydratedDocument<ProductType>;
export type ProductSizeDocument = HydratedDocument<ProductSize>;

@Schema({ _id: true })
export class ProductSize {
  _id!: Types.ObjectId;

  @Prop({ required: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ required: true, trim: true })
  dimensions!: string;

  /** Explanatory line shown next to the option for the customer. */
  @Prop({ required: true, trim: true })
  explainer!: string;

  /**
   * Selling price. Must use the database's exact decimal type; a floating point
   * number would drift once amounts are added or subtracted.
   */
  @Prop({ type: MongooseSchema.Types.Decimal128, required: true })
  price!: Types.Decimal128;

  @Prop({ required: true, default: 'VND', uppercase: true, trim: true })
  currency!: string;

  @Prop({ type: Number, required: true, min: 1 })
  productionDays!: number;

  @Prop({ type: Number, default: 4, min: 1 })
  minPhotos!: number;

  @Prop({ type: Number, default: 3, min: 0 })
  maxAccessories!: number;

  @Prop({ trim: true, default: '' })
  imageUrl!: string;

  @Prop({ default: true })
  enabled!: boolean;
}

export const ProductSizeSchema = SchemaFactory.createForClass(ProductSize);

@Schema({ timestamps: true, collection: 'product_types' })
export class ProductType {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  code!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true, default: '' })
  description!: string;

  /** Material shown to the customer, for example premium recycled fabric. */
  @Prop({ trim: true, default: '' })
  material!: string;

  /** Illustration for the product type as a whole, used on the list page. */
  @Prop({ trim: true, default: '' })
  imageUrl!: string;

  @Prop({ type: [ProductSizeSchema], default: [] })
  sizes!: ProductSize[];

  @Prop({ default: true, index: true })
  enabled!: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder!: number;
}

export const ProductTypeSchema = SchemaFactory.createForClass(ProductType);
