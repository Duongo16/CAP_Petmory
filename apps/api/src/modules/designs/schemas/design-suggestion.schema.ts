import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { AiMode } from '../../ai/schemas/ai-usage.schema';
import { ZonePaint, ZonePaintSchema } from './design.schema';

export type DesignSuggestionDocument = HydratedDocument<DesignSuggestion>;

/**
 * Cac phong cach nguoi dung chon truoc khi xin goi y.
 *
 * Danh sach dong, khong nhan chu tu do, de mot phong cach la khong the di
 * thang vao loi dan gui cho dich vu ben ngoai.
 */
export enum SuggestStyle {
  /** Bam sat mau long that cua be. */
  TRUE_TO_LIFE = 'TRUE_TO_LIFE',
  /** Mau diu, nha nhan, hop lam qua tuong nho. */
  SOFT = 'SOFT',
  /** Mau tuoi, tuong phan manh, nhin vui mat. */
  VIVID = 'VIVID',
  /** Mau phan nhat, kieu tranh ve cho tre nho. */
  PASTEL = 'PASTEL',
}

/** Nhieu nhat bon phuong an moi lan, dung nhu hop dong ghi. */
export const MAX_OPTION = 4;

/**
 * Mot phuong an thiet ke.
 *
 * Phuong an khong phai la mot mo hinh moi: no chi ra lay mau nen nao trong
 * thu vien va to mau gi cho tung vung co ten. Hop dong ghi ro he thong khong
 * tu dung mo hinh ba chieu moi tu anh.
 */
@Schema({ _id: false })
export class SuggestOption {
  /** Ma ngan de nguoi dung chon dung mot phuong an. */
  @Prop({ required: true, trim: true, maxlength: 20 })
  key!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  title!: string;

  /** Vi sao phuong an nay hop voi be, viet cho nguoi dung doc. */
  @Prop({ trim: true, default: '', maxlength: 600 })
  rationale!: string;

  /** Ma mau nen trong thu vien mo hinh. */
  @Prop({ required: true, trim: true, maxlength: 40 })
  modelCode!: string;

  @Prop({ type: [ZonePaintSchema], default: [] })
  zonePaint!: ZonePaint[];
}

export const SuggestOptionSchema = SchemaFactory.createForClass(SuggestOption);

/**
 * Mot lan xin goi y thiet ke, kem cac phuong an nhan duoc.
 *
 * Giu lai ca lan da chon lan chua chon, vi con so nay la can cu tinh chi phi
 * va vi nguoi dung co the quay lai xem lai cac phuong an cu.
 */
@Schema({ timestamps: true, collection: 'design_suggestions' })
export class DesignSuggestion {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Pet', required: true, index: true })
  pet!: Types.ObjectId;

  /** Ma tra cuu, dung tren duong dan thay cho ma noi bo. */
  @Prop({ required: true, unique: true, trim: true })
  code!: string;

  @Prop({ type: String, enum: SuggestStyle, required: true })
  style!: SuggestStyle;

  /** Lan nay do dich vu that tra ve hay do bo goi y mau dung san. */
  @Prop({ type: String, enum: AiMode, default: AiMode.SAMPLE })
  mode!: AiMode;

  @Prop({ type: [SuggestOptionSchema], default: [] })
  option!: SuggestOption[];

  /** Phuong an nguoi dung da chon. Rong khi chua chon. */
  @Prop({ trim: true, default: '', maxlength: 20 })
  chosenKey!: string;

  /** Ban thiet ke sinh ra tu phuong an da chon. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Design', default: null })
  appliedDesign!: Types.ObjectId | null;
}

export const DesignSuggestionSchema = SchemaFactory.createForClass(DesignSuggestion);
DesignSuggestionSchema.index({ owner: 1, createdAt: -1 });
