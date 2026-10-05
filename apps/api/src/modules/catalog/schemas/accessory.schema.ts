import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

export type AccessoryDocument = HydratedDocument<Accessory>;

/**
 * Diem neo tren mau nen ma phu kien gan vao.
 *
 * Moi diem neo chi nhan mot phu kien, de mu va no khong chong len nhau tren
 * cung mot cho.
 */
export enum AccessoryAnchor {
  HEAD = 'HEAD',
  FACE = 'FACE',
  NECK = 'NECK',
  BACK = 'BACK',
}

/** Ten nut neo trong tep mo hinh ung voi tung diem neo. */
export const ANCHOR_NODE: Record<AccessoryAnchor, string> = {
  [AccessoryAnchor.HEAD]: 'PM_ANCHOR_HEAD',
  [AccessoryAnchor.FACE]: 'PM_ANCHOR_FACE',
  [AccessoryAnchor.NECK]: 'PM_ANCHOR_NECK',
  [AccessoryAnchor.BACK]: 'PM_ANCHOR_BACK',
};

/**
 * Mot phu kien dung chung gan duoc len mau nen (muc 5, 6, 12).
 *
 * Gia cong them vao don gia cua dong hang va duoc may chu tinh, khong lay so
 * trinh duyet gui len.
 */
@Schema({ timestamps: true, collection: 'accessories' })
export class Accessory {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, maxlength: 30 })
  code!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  displayName!: string;

  @Prop({ trim: true, default: '', maxlength: 500 })
  description!: string;

  @Prop({ type: String, enum: AccessoryAnchor, required: true })
  anchor!: AccessoryAnchor;

  /** Ten tep mo hinh trong thu muc mo hinh cua trang, vi du acc-knit-hat.glb. */
  @Prop({ required: true, trim: true, maxlength: 80 })
  modelFile!: string;

  /** Tien cong them, so nguyen dong chinh xac. Khong am. */
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

export const AccessorySchema = SchemaFactory.createForClass(Accessory);
