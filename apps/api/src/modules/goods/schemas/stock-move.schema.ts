import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type StockMoveDocument = HydratedDocument<StockMove>;

/** Vi sao ton kho thay doi. */
export enum StockReason {
  MANUAL = 'MANUAL',
  ORDER_PAID = 'ORDER_PAID',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
}

/**
 * Mot lan ton kho thay doi.
 *
 * Ghi them chu khong sua: moi lan tang hay giam deu la mot dong moi, kem so
 * truoc va so sau. Nho vay lich su ton kho cua tung to hop doc lai duoc va
 * khong ai co the lam mat dau vet mot lan dieu chinh.
 */
@Schema({ timestamps: true, collection: 'stock_moves' })
export class StockMove {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Goods', required: true, index: true })
  goods!: Types.ObjectId;

  @Prop({ required: true, uppercase: true, trim: true })
  sku!: string;

  /** So luong thay doi. Am la tru kho, duong la nhap them. */
  @Prop({ type: Number, required: true })
  delta!: number;

  @Prop({ type: Number, required: true })
  before!: number;

  @Prop({ type: Number, required: true })
  after!: number;

  @Prop({ type: String, enum: StockReason, required: true })
  reason!: StockReason;

  /** Ly do bang loi, bat buoc khi nguoi dung dieu chinh bang tay. */
  @Prop({ trim: true, default: '', maxlength: 300 })
  note!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  actor!: Types.ObjectId | null;

  /** Don hang lam ton kho doi, neu lan doi nay den tu mot don. */
  @Prop({ uppercase: true, trim: true, default: '' })
  orderCode!: string;
}

export const StockMoveSchema = SchemaFactory.createForClass(StockMove);
StockMoveSchema.index({ goods: 1, sku: 1, createdAt: -1 });
