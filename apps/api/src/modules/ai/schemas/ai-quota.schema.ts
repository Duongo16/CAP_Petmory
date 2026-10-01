import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { AiKind } from './ai-usage.schema';

export type AiQuotaDocument = HydratedDocument<AiQuota>;

/** Ba khoang han muc ma hop dong ke ra. */
export enum QuotaSpan {
  DAY = 'day',
  MONTH = 'month',
  YEAR = 'year',
}

/**
 * So dem so luot da dung cua mot nguoi, trong mot khoang, cho mot chuc nang.
 *
 * Han muc duoc giu bang so dem rieng chu khong bang cach dem lai cac ban ghi
 * ket qua. Ly do la hai yeu cau gui cung luc deu dem ra con so cu roi deu cho
 * qua, va nguoi dung vuot han muc ma he thong khong he hay biet. Voi so dem
 * nay, viec kiem va viec cong duoc lam trong cung mot buoc khong the chen vao
 * giua, nen hai yeu cau song song chi mot cai di qua duoc.
 */
@Schema({ timestamps: true, collection: 'ai_quotas' })
export class AiQuota {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  owner!: Types.ObjectId;

  @Prop({ type: String, enum: AiKind, required: true })
  kind!: AiKind;

  @Prop({ type: String, enum: QuotaSpan, required: true })
  span!: QuotaSpan;

  /** Ten khoang, vi du mot ngay hay mot thang, tinh theo gio quoc te. */
  @Prop({ required: true, trim: true })
  slot!: string;

  @Prop({ type: Number, default: 0, min: 0 })
  used!: number;
}

export const AiQuotaSchema = SchemaFactory.createForClass(AiQuota);

/*
 * Moi nguoi chi co dung mot dong cho mot chuc nang trong mot khoang. Rang
 * buoc nay nam o tang co so du lieu chu khong o tang ma nguon, nen hai yeu
 * cau gui cung luc khong the tao ra hai dong roi dem tach nhau.
 */
AiQuotaSchema.index({ owner: 1, kind: 1, span: 1, slot: 1 }, { unique: true });
