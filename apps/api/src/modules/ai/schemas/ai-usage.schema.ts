import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AiUsageDocument = HydratedDocument<AiUsage>;

/**
 * Bon loai luot dung tri tue nhan tao ma hop dong ke ra.
 *
 * Ten trung voi ten cua bon don gia trong tham so nghiep vu, de bao cao chi
 * phi khong phai dich qua mot bang trung gian nao.
 */
export enum AiKind {
  RESTORE_PHOTO = 'restorePhoto',
  DESIGN_SUGGESTION = 'designSuggestion',
  STORY_WRITING = 'storyWriting',
  CHAT_REPLY = 'chatReply',
}

/** Mot luot dung chay that hay chay bang bo tra loi mau. */
export enum AiMode {
  /** Goi dich vu tri tue nhan tao that. */
  LIVE = 'LIVE',
  /** Khong co khoa hoac dich vu loi, tra ket qua mau. */
  SAMPLE = 'SAMPLE',
  /** Xu ly anh ngay tren may chu bang bo loc, khong goi dich vu tri tue nhan tao nao. */
  LOCAL = 'LOCAL',
}

/**
 * Mot luot dung tri tue nhan tao.
 *
 * Don gia duoc chep vao day ngay luc dung, khong tro sang tham so nghiep vu.
 * Muc 22 khoan 6 ghi ro doi don gia khong duoc lam doi so lieu ky da qua, ma
 * dieu do chi dung neu tung luot tu nho gia cua chinh no.
 *
 * So nay ghi them chu khong sua: khong duong nao trong ma nguon doi mot dong
 * da ghi, va bao cao doc thang tu day.
 */
@Schema({ timestamps: true, collection: 'ai_usages' })
export class AiUsage {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ type: String, enum: AiKind, required: true, index: true })
  kind!: AiKind;

  /** Don gia tai thoi diem dung, so thap phan chinh xac, don vi la dong. */
  @Prop({ type: MongooseSchema.Types.Decimal128, required: true })
  unitPrice!: Types.Decimal128;

  @Prop({ type: String, enum: AiMode, default: AiMode.SAMPLE })
  mode!: AiMode;

  /** Ban ghi ma luot dung nay sinh ra, de lan theo khi can doi soat. */
  @Prop({ trim: true, default: '' })
  resourceId!: string;

  /** Loi khi goi dich vu that, de nguoi truc biet vi sao mot luot that bai. */
  @Prop({ trim: true, default: '' })
  problem!: string;
}

export const AiUsageSchema = SchemaFactory.createForClass(AiUsage);
AiUsageSchema.index({ createdAt: -1, kind: 1 });
