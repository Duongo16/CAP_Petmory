import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type MemoryDocument = HydratedDocument<Memory>;

/**
 * What a remembered moment is about.
 *
 * The list is closed so the diary can be filtered and counted. Anything to do
 * with treatment or illness is deliberately absent: it was agreed that this
 * product keeps no health records.
 */
export enum MemoryTopic {
  FIRST_DAY = 'FIRST_DAY',
  BIRTHDAY = 'BIRTHDAY',
  OUTING = 'OUTING',
  FUNNY = 'FUNNY',
  LEARNING = 'LEARNING',
  EVERYDAY = 'EVERYDAY',
}

/**
 * Nhung thu nguoi dung dat len mot trang so.
 *
 * Mot trang la mot to giay: chu viet tay, anh dan vao, va hinh trang tri.
 * Vi tri ghi theo phan tram cua trang chu khong theo diem anh, de trang bay
 * ra man hinh nao, in ra giay kho nao, moi thu van nam dung cho cu.
 */
@Schema({ _id: false })
export class DecorItem {
  @Prop({ type: String, enum: ['TEXT', 'PHOTO', 'STICKER'], required: true })
  kind!: string;

  @Prop({ type: Number, required: true, min: -20, max: 120 })
  x!: number;

  @Prop({ type: Number, required: true, min: -20, max: 120 })
  y!: number;

  @Prop({ type: Number, required: true, min: 4, max: 100 })
  width!: number;

  @Prop({ type: Number, default: 0, min: -45, max: 45 })
  rotate!: number;

  /** Thu tu chong len nhau. So lon nam tren. */
  @Prop({ type: Number, default: 0, min: 0, max: 200 })
  z!: number;

  @Prop({ trim: true, default: '', maxlength: 600 })
  text!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'PetPhoto', default: null })
  photo!: Types.ObjectId | null;

  /** Ma hinh trang tri, lay tu bo hinh co san cua trang. */
  @Prop({ trim: true, default: '', maxlength: 30 })
  sticker!: string;

  /** Mau chu hoac mau hinh, ghi theo ma mau sau chu so. */
  @Prop({ trim: true, default: '', maxlength: 9 })
  color!: string;

  /** Kieu chu cua o chu, lay tu bo kieu chu co san. */
  @Prop({ trim: true, default: '', maxlength: 20 })
  fontKey!: string;
}

export const DecorItemSchema = SchemaFactory.createForClass(DecorItem);

@Schema({ timestamps: true, collection: 'memories' })
export class Memory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Pet', required: true, index: true })
  pet!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({ trim: true, default: '', maxlength: 4000 })
  body!: string;

  /** When the moment happened, which is rarely when it was written down. */
  @Prop({ type: Date, required: true, index: true })
  happenedAt!: Date;

  @Prop({ trim: true, default: '', maxlength: 200 })
  place!: string;

  @Prop({ type: String, enum: MemoryTopic, default: MemoryTopic.EVERYDAY, index: true })
  topic!: MemoryTopic;

  /** Short words the owner files the moment under, stored without the hash. */
  @Prop({ type: [String], default: [] })
  tag!: string[];

  /** Pictures already in the pet's album, kept by their own identifiers. */
  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'PetPhoto', default: [] })
  photo!: Types.ObjectId[];

  /** A moment the owner marked as one worth remembering above the rest. */
  @Prop({ type: Boolean, default: false })
  isMilestone!: boolean;

  /**
   * Cach bay tri trang so cho khoanh khac nay.
   *
   * De trong thi trang van hien duoc, vi luc do trang tu xep theo loi mac
   * dinh: tieu de, ngay thang, loi ke va anh xep hang. Bay tri chi la lop
   * them vao, khong phai dieu kien de doc duoc mot khoanh khac.
   */
  @Prop({ type: [DecorItemSchema], default: [] })
  decor!: DecorItem[];

  /** Kieu giay cua trang, lay tu bo giay co san cua trang. */
  @Prop({ trim: true, default: 'CREAM', maxlength: 20 })
  paper!: string;

  /** Soft delete, per the rule that business data is never hard deleted. */
  @Prop({ default: false, index: true })
  isHidden!: boolean;

  @Prop({ type: Date, default: null })
  hiddenAt!: Date | null;
}

export const MemorySchema = SchemaFactory.createForClass(Memory);
MemorySchema.index({ pet: 1, isHidden: 1, happenedAt: -1 });
MemorySchema.index({ owner: 1, isHidden: 1, happenedAt: -1 });
