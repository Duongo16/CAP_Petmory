import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AssistantKnowledgeDocument = HydratedDocument<AssistantKnowledge>;

/** Nhom chu de cua mot muc hoi dap, de loc tren trang quan tri. */
export enum KnowledgeTopic {
  PRODUCT = 'PRODUCT',
  SIZE = 'SIZE',
  LEAD_TIME = 'LEAD_TIME',
  ORDER = 'ORDER',
  PAYMENT = 'PAYMENT',
  SHIPPING = 'SHIPPING',
  POLICY = 'POLICY',
  OTHER = 'OTHER',
}

/**
 * Mot muc trong kho tri thuc cua tro ly.
 *
 * Nhom Quan ly soan va sua cac muc nay tren trang quan tri, tro ly chi doc ra.
 * Cau tra loi la chu thuong va co the chen cac o dien san nhu bang gia, de
 * nhung con so luon lay tu danh muc that chu khong bi go cung vao chu.
 */
@Schema({ timestamps: true, collection: 'assistant_knowledge' })
export class AssistantKnowledge {
  /** Ma ngan, duy nhat, dung de noi cac cau goi y tiep theo voi nhau. */
  @Prop({ required: true, unique: true, uppercase: true, trim: true, maxlength: 40 })
  code!: string;

  /** Cau hoi mau, cung la chu hien tren nut goi y. */
  @Prop({ required: true, trim: true, maxlength: 160 })
  question!: string;

  /** Cac tu khoa de nhan ra cau hoi, so khi da bo dau. */
  @Prop({ type: [String], default: [] })
  keywords!: string[];

  @Prop({ required: true, trim: true, maxlength: 2000 })
  answer!: string;

  /** Duong dan trong trang de dan khach toi, rong neu khong can. */
  @Prop({ trim: true, default: '', maxlength: 200 })
  link!: string;

  @Prop({ type: String, enum: KnowledgeTopic, default: KnowledgeTopic.OTHER, index: true })
  topic!: KnowledgeTopic;

  /** Ma cac muc nen goi y tiep sau khi tra loi muc nay. */
  @Prop({ type: [String], default: [] })
  followUp!: string[];

  /** Hien ngay tu dau khi khach mo khung chat. */
  @Prop({ type: Boolean, default: false })
  starter!: boolean;

  @Prop({ type: Boolean, default: true, index: true })
  enabled!: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder!: number;

  /** Xoa mem: muc da an khong con duoc dung va khong hien tren trang quan tri. */
  @Prop({ type: Boolean, default: false, index: true })
  isHidden!: boolean;
}

export const AssistantKnowledgeSchema = SchemaFactory.createForClass(AssistantKnowledge);
