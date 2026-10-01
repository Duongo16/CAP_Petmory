import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type DiaryShareDocument = HydratedDocument<DiaryShare>;

/**
 * Mot duong dan chia se mot quyen nhat ky.
 *
 * Ma trong duong dan chinh la chia khoa mo quyen, nen ban nguyen van khong
 * bao gio duoc luu lai: chi giu ban bam cua no, giong cach lam voi ma dat
 * lai mat khau. Ai cam duoc duong dan thi doc duoc, va chu quyen thu hoi
 * duoc bat ky duong dan nao ma khong dung den nhung duong dan con lai.
 */
@Schema({ timestamps: true, collection: 'diary_shares' })
export class DiaryShare {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Pet', required: true, index: true })
  pet!: Types.ObjectId;

  /** Ban bam cua ma trong duong dan. Ma nguyen van chi hien dung mot lan. */
  @Prop({ required: true, unique: true })
  codeHash!: string;

  /** De trong nghia la khong bao gio het han. */
  @Prop({ type: Date, default: null })
  expiresAt!: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: Number, default: 0 })
  viewCount!: number;

  @Prop({ type: Date, default: null })
  lastViewedAt!: Date | null;
}

export const DiaryShareSchema = SchemaFactory.createForClass(DiaryShare);
DiaryShareSchema.index({ pet: 1, revokedAt: 1 });
