import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DisplayBaseDocument = HydratedDocument<DisplayBase>;

/**
 * A stand the finished figure is mounted on. The customer picks one on the
 * product page, and the price difference is added to the line by the server.
 */
@Schema({ timestamps: true, collection: 'display_bases' })
export class DisplayBase {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  code!: string;

  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ trim: true, default: '' })
  description!: string;

  /**
   * Amount added to the size price, as an exact decimal. Zero means the base
   * costs nothing extra; there is no negative option.
   */
  @Prop({ type: Types.Decimal128, required: true })
  priceDelta!: Types.Decimal128;

  @Prop({ required: true, default: 'VND', uppercase: true, trim: true })
  currency!: string;

  @Prop({ default: true, index: true })
  enabled!: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder!: number;
}

export const DisplayBaseSchema = SchemaFactory.createForClass(DisplayBase);
