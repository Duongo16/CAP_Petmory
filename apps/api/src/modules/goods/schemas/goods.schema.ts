import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type GoodsDocument = HydratedDocument<Goods>;

/**
 * Mot to hop bien the cua mot mon hang.
 *
 * Moi to hop co gia rieng va ton kho rieng, vi mot chiec vong co so mot va
 * mot chiec vong co so ba khong cung gia va khong cung so luong trong kho.
 */
@Schema({ _id: false })
export class GoodsVariant {
  /** Ma cua to hop, duy nhat trong pham vi mot mon hang. */
  @Prop({ required: true, uppercase: true, trim: true, maxlength: 40 })
  sku!: string;

  /**
   * Gia tri cua tung thuoc tinh, theo dung thu tu ten thuoc tinh cua mon hang.
   * Mon hang co mot thuoc tinh thi day co mot phan tu, hai thuoc tinh thi hai.
   */
  @Prop({ type: [String], default: [] })
  optionValues!: string[];

  /** Gia ban, so nguyen dong, giu o dang so thap phan chinh xac. */
  @Prop({ type: MongooseSchema.Types.Decimal128, required: true })
  price!: Types.Decimal128;

  /** So luong con trong kho. Khong bao gio duoc phep am. */
  @Prop({ type: Number, required: true, min: 0, default: 0 })
  stock!: number;

  @Prop({ type: Boolean, default: true })
  enabled!: boolean;
}

export const GoodsVariantSchema = SchemaFactory.createForClass(GoodsVariant);

/**
 * Mot mon hang co san.
 *
 * Khac han hang tuy bien: khong gan voi anh hay ban thiet ke cua khach, khong
 * di qua xuong, va so luong ban duoc bi gioi han boi so luong co trong kho.
 */
@Schema({ timestamps: true, collection: 'goods' })
export class Goods {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, maxlength: 40 })
  code!: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  name!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'GoodsCategory', required: true, index: true })
  category!: Types.ObjectId;

  @Prop({ trim: true, default: '', maxlength: 2000 })
  description!: string;

  /** Cac dia chi anh cua mon hang. Anh dau tien la anh dai dien. */
  @Prop({ type: [String], default: [] })
  images!: string[];

  /**
   * Ten cua toi da hai thuoc tinh bien the, do Ben A dat.
   * Vi du: mot mon co the co thuoc tinh "Kich co" va "Mau".
   */
  @Prop({ type: [String], default: [] })
  optionNames!: string[];

  @Prop({ type: [GoodsVariantSchema], default: [] })
  variant!: GoodsVariant[];

  /** So ngay giao du kien cua mon hang nay. Hang co san thuong nhanh hon. */
  @Prop({ type: Number, required: true, min: 1, max: 60, default: 2 })
  deliveryDays!: number;

  @Prop({ type: Boolean, default: true, index: true })
  enabled!: boolean;

  /** Soft delete, per the rule that business data is never hard deleted. */
  @Prop({ type: Boolean, default: false, index: true })
  isHidden!: boolean;
}

export const GoodsSchema = SchemaFactory.createForClass(Goods);
GoodsSchema.index({ isHidden: 1, enabled: 1, category: 1 });
GoodsSchema.index({ name: 'text' });
