import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ChatSessionDocument = HydratedDocument<ChatSession>;

/** Ai da noi mot luot. */
export enum ChatSide {
  USER = 'USER',
  BOT = 'BOT',
  STAFF = 'STAFF',
}

/**
 * Mot phien hoi thoai dang o buoc nao.
 *
 * Chuyen trang thai duoc khai ra o day va chi duoc di theo cac buoc da cho
 * phep, chu khong dat tu do, de mot phien khong the nhay tu dong sang dang
 * duoc tra loi ma khong qua hang cho.
 */
export enum ChatState {
  /** May dang tra loi. */
  BOT = 'BOT',
  /** Da xin gap nguoi, dang cho mot nhan vien nhan. */
  WAITING = 'WAITING',
  /** Mot nhan vien da nhan va dang tra loi. */
  WITH_STAFF = 'WITH_STAFF',
  /** Da khep lai. */
  CLOSED = 'CLOSED',
}

/** Cac buoc chuyen trang thai duoc phep. */
export const CHAT_NEXT: Record<ChatState, ChatState[]> = {
  [ChatState.BOT]: [ChatState.WAITING, ChatState.CLOSED],
  [ChatState.WAITING]: [ChatState.WITH_STAFF, ChatState.BOT, ChatState.CLOSED],
  [ChatState.WITH_STAFF]: [ChatState.CLOSED],
  [ChatState.CLOSED]: [],
};

/** Mot luot noi trong phien. */
@Schema({ _id: false, timestamps: { createdAt: 'at', updatedAt: false } })
export class ChatTurn {
  @Prop({ type: String, enum: ChatSide, required: true })
  side!: ChatSide;

  @Prop({ required: true, trim: true, maxlength: 4000 })
  text!: string;

  /** Cac cau hoi goi y kem theo, de nguoi dung bam tiep. */
  @Prop({ type: [String], default: [] })
  suggestion!: string[];

  /** Duong dan man hinh dan toi, rong neu khong dan di dau. */
  @Prop({ trim: true, default: '', maxlength: 200 })
  path!: string;

  /** Ma cac san pham duoc nhac toi, de man hinh dung the san pham that. */
  @Prop({ type: [String], default: [] })
  productCode!: string[];

  @Prop({ type: [String], default: [] })
  goodsCode!: string[];

  @Prop({ type: Date, default: () => new Date() })
  at!: Date;
}

export const ChatTurnSchema = SchemaFactory.createForClass(ChatTurn);

/**
 * Mot phien hoi thoai.
 *
 * Ma phien la mot chuoi ngau nhien dai, va chinh no la chia khoa doc phien
 * do: khach chua dang nhap van phai giu duoc mach hoi thoai cua minh. Voi
 * khach da dang nhap thi kiem them chu so huu, de mot nguoi co ma cung khong
 * doc duoc phien cua tai khoan khac.
 */
@Schema({ timestamps: true, collection: 'chat_sessions' })
export class ChatSession {
  @Prop({ required: true, unique: true, trim: true })
  code!: string;

  /** Chu phien khi ho da dang nhap. Rong voi khach van dang xem. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null, index: true })
  owner!: Types.ObjectId | null;

  @Prop({ type: String, enum: ChatState, default: ChatState.BOT, index: true })
  state!: ChatState;

  /** Nhan vien dang nhan phien nay. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  staff!: Types.ObjectId | null;

  /**
   * Cac luot noi, cu nhat truoc.
   *
   * Chi giu lai mot so luot gan day. Mot phien keo dai ca ngay van doc duoc,
   * nhung ban ghi khong phinh vo han va phan nho lai cho dich vu ben ngoai
   * khong vuot qua muc chiu duoc.
   */
  @Prop({ type: [ChatTurnSchema], default: [] })
  turn!: ChatTurn[];

  /** Luot noi cuoi cung, de trang truc sap xep theo nguoi cho lau nhat. */
  @Prop({ type: Date, default: () => new Date(), index: true })
  lastAt!: Date;

  /** Cau hoi khach go khi xin gap nguoi, de nhan vien biet ngay viec gi. */
  @Prop({ trim: true, default: '', maxlength: 500 })
  handoverNote!: string;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
ChatSessionSchema.index({ state: 1, lastAt: 1 });
