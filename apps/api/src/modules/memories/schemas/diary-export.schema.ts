import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type DiaryExportDocument = HydratedDocument<DiaryExport>;

/** Mot lan xuat quyen nhat ky ra tep doc duoc. */
export enum ExportState {
  PENDING = 'PENDING',
  READY = 'READY',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

/**
 * Yeu cau xuat mot quyen nhat ky.
 *
 * Xuat la viec chay nen, nen ban ghi nay la cho de nguoi dung hoi lai xem
 * xong chua. Tep xuat ra tu bien mat sau mot khoang thoi gian do nhom Quan
 * ly dat, nho mot chi muc tu xoa cua co so du lieu.
 */
@Schema({ timestamps: true, collection: 'diary_exports' })
export class DiaryExport {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Pet', required: true, index: true })
  pet!: Types.ObjectId;

  @Prop({ type: String, enum: ExportState, default: ExportState.PENDING, index: true })
  state!: ExportState;

  /** Khoang thoi gian nguoi dung chon. De trong la lay ca quyen. */
  @Prop({ type: Date, default: null })
  fromDate!: Date | null;

  @Prop({ type: Date, default: null })
  toDate!: Date | null;

  /** Ten tep trong kho, chi co may chu biet. */
  @Prop({ trim: true, default: '' })
  fileName!: string;

  @Prop({ type: Number, default: 0 })
  byteSize!: number;

  @Prop({ type: Number, default: 0 })
  momentCount!: number;

  /** Ly do that bai, viet cho nguoi doc chu khong phai vet loi ky thuat. */
  @Prop({ trim: true, default: '' })
  problem!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;
}

export const DiaryExportSchema = SchemaFactory.createForClass(DiaryExport);

/*
 * Ban ghi duoc giu lai sau khi den han, chi doi trang thai sang het han va
 * tep trong kho bi xoa di. Giu ban ghi de con vet ai da xuat quyen nao va
 * luc nao, con tep thi khong ai tai ve duoc nua ke tu moc do.
 */
DiaryExportSchema.index({ expiresAt: 1, state: 1 });
