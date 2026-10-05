import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

export type PackagingOptionDocument = HydratedDocument<PackagingOption>;

/** Hop dung tuong khi giao, hay khung trung bay di kem. */
export enum PackagingKind {
  BOX = 'BOX',
  FRAME = 'FRAME',
}

/**
 * Mot mau hop hoac khung trong danh muc vat lieu (muc 12).
 *
 * Danh muc nay do Quan ly bat tat va dat gia. Tien la so nguyen dong chinh xac.
 */
@Schema({ timestamps: true, collection: 'packaging_options' })
export class PackagingOption {
  @Prop({ type: String, enum: PackagingKind, required: true, index: true })
  kind!: PackagingKind;

  @Prop({ required: true, unique: true, uppercase: true, trim: true, maxlength: 30 })
  code!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  displayName!: string;

  @Prop({ trim: true, default: '', maxlength: 500 })
  description!: string;

  @Prop({ type: MongooseSchema.Types.Decimal128, required: true })
  priceDelta!: Types.Decimal128;

  @Prop({ required: true, default: 'VND', uppercase: true, trim: true })
  currency!: string;

  @Prop({ trim: true, default: '' })
  imageUrl!: string;

  @Prop({ default: true, index: true })
  enabled!: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder!: number;
}

export const PackagingOptionSchema = SchemaFactory.createForClass(PackagingOption);
