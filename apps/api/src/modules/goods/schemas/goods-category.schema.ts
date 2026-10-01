import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoodsCategoryDocument = HydratedDocument<GoodsCategory>;

/**
 * Mot nhom hang co san.
 *
 * Danh muc nay tach hoan toan khoi danh muc hang tuy bien: hai dong hang ban
 * theo hai cach khac nhau, va gop chung mot danh muc thi trang khach se lan
 * lon giua mon do lam theo anh cua be va mon do nhap ve ban.
 */
@Schema({ timestamps: true, collection: 'goods_categories' })
export class GoodsCategory {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, maxlength: 30 })
  code!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ trim: true, default: '', maxlength: 500 })
  description!: string;

  /** Thu tu hien tren trang khach. So nho len truoc. */
  @Prop({ type: Number, default: 0 })
  sortOrder!: number;

  @Prop({ type: Boolean, default: true, index: true })
  enabled!: boolean;

  /** Soft delete, per the rule that business data is never hard deleted. */
  @Prop({ type: Boolean, default: false, index: true })
  isHidden!: boolean;
}

export const GoodsCategorySchema = SchemaFactory.createForClass(GoodsCategory);
GoodsCategorySchema.index({ isHidden: 1, enabled: 1, sortOrder: 1 });
