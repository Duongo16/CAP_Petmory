import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

export type BusinessConfigDocument = HydratedDocument<BusinessConfig>;

/**
 * Don gia mot luot cho tung chuc nang dung tri tue nhan tao.
 *
 * Tien khong bao gio duoc giu o dang so thuc dau cham dong, nen tung muc o
 * day la so thap phan chinh xac, don vi la dong.
 */
@Schema({ _id: false })
export class AiUnitPrice {
  @Prop({ type: MongooseSchema.Types.Decimal128, default: () => Types.Decimal128.fromString('0') })
  restorePhoto!: Types.Decimal128;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: () => Types.Decimal128.fromString('0') })
  designSuggestion!: Types.Decimal128;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: () => Types.Decimal128.fromString('0') })
  storyWriting!: Types.Decimal128;

  @Prop({ type: MongooseSchema.Types.Decimal128, default: () => Types.Decimal128.fromString('0') })
  chatReply!: Types.Decimal128;
}

export const AiUnitPriceSchema = SchemaFactory.createForClass(AiUnitPrice);

/** Mot ban nhac trong kho, do Ben A cung cap kem ban quyen. */
@Schema({ _id: false })
export class MusicTrack {
  @Prop({ required: true, trim: true, maxlength: 60 })
  code!: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  /** Dia chi tep nhac. Phai la dia chi cong khai doc duoc tu trinh duyet. */
  @Prop({ required: true, trim: true, maxlength: 500 })
  url!: string;

  /** Ghi cong tac gia va giay phep, hien kem khi phat. */
  @Prop({ trim: true, default: '', maxlength: 300 })
  credit!: string;
}

export const MusicTrackSchema = SchemaFactory.createForClass(MusicTrack);

/**
 * Business settings owned by the Manager group.
 * Exactly one record exists, identified by a fixed key.
 */
@Schema({ timestamps: true, collection: 'business_config' })
export class BusinessConfig {
  @Prop({ required: true, unique: true, default: 'DEFAULT' })
  key!: string;

  @Prop({ type: Number, default: 5, min: 1 })
  defaultPetProfileLimit!: number;

  @Prop({ type: Number, default: 24, min: 1 })
  qrExpiryHours!: number;

  @Prop({ type: Number, default: 3, min: 1 })
  estimatedShippingDays!: number;

  @Prop({ type: Number, default: 1024, min: 1 })
  goodShortEdgePx!: number;

  @Prop({ type: Number, default: 600, min: 1 })
  warnShortEdgePx!: number;

  @Prop({ type: Number, default: 10, min: 1 })
  maxPhotoSizeMb!: number;

  /**
   * How closely a restored photo must still resemble the original, as a
   * percentage, before the customer is warned that the pet may have changed.
   */
  @Prop({ type: Number, default: 90, min: 50, max: 100 })
  minResemblancePercent!: number;

  /**
   * Han muc so luot dung cho tung chuc nang, theo ngay, thang va nam.
   *
   * Dat bang khong o cho nao thi cho do khong gioi han. Bon chuc nang deu co
   * mat san, de nhom Quan ly khong phai tu go ten khoa vao moi sua duoc.
   */
  @Prop({
    type: Object,
    default: () => ({
      restorePhoto: { day: 20, month: 300, year: 3000 },
      designSuggestion: { day: 10, month: 150, year: 1500 },
      storyWriting: { day: 10, month: 150, year: 1500 },
      chatReply: { day: 60, month: 900, year: 9000 },
    }),
  })
  aiQuota!: Record<string, { day: number; month: number; year: number }>;

  /** Receiving bank identifier, six digits per the card scheme standard. */
  @Prop({ trim: true, default: '970415' })
  bankCode!: string;

  @Prop({ trim: true, default: 'VietinBank' })
  bankName!: string;

  @Prop({ trim: true, default: '0000000000' })
  accountNumber!: string;

  @Prop({ trim: true, default: 'PETMORY DEMO' })
  accountHolder!: string;

  /**
   * Cac muc tich cua phieu kiem tra chat luong, theo dung thu tu xuong lam.
   *
   * De o day chu khong viet cung trong ma nguon, vi moi xuong soat mot kieu
   * va Phu luc 01 muc 13 giao viec dat cac tham so nay cho nhom Quan ly.
   */
  @Prop({
    type: [String],
    default: [
      'Dung phom dang da duyet',
      'Dung mau tung vung',
      'Chu khac dung chinh ta',
      'Du phu kien',
      'Dung loai de',
      'Khong sot kim trong san pham',
      'Dong goi du hop va thiep',
    ],
  })
  qcChecklist!: string[];

  /**
   * Don gia moi luot dung tri tue nhan tao, dung de tinh chi phi trong bao cao.
   *
   * Day la tien, nen tung con so duoc luu o dang so thap phan chinh xac chu
   * khong phai so thuc dau cham dong, va bon luot dung deu duoc goi ten day
   * du thay vi de mot bang tu do.
   */
  @Prop({ type: AiUnitPriceSchema, default: () => ({}) })
  aiUnitPrice!: AiUnitPrice;

  /** Tep nhat ky da xuat duoc giu bao nhieu gio truoc khi bi xoa. */
  @Prop({ type: Number, default: 24, min: 1, max: 720 })
  exportKeepHours!: number;

  /**
   * Duong dan chia se moi tao mac dinh song bao nhieu ngay.
   * So khong nghia la khong dat han, duong dan song den khi bi thu hoi.
   */
  @Prop({ type: Number, default: 0, min: 0, max: 3650 })
  shareDefaultDays!: number;

  /**
   * Kho nhac dung cho trinh chieu.
   *
   * Nhac chi duoc lay tu day, khong co duong nao cho nguoi dung tai nhac len,
   * vi ban quyen cua tung ban nhac thuoc ve Ben A. De trong thi trinh chieu
   * chay khong nhac, va man hinh noi ro la kho nhac chua co gi.
   */
  @Prop({ type: [MusicTrackSchema], default: [] })
  musicLibrary!: MusicTrack[];

  /** Moi anh dung bao lau khi trinh chieu quyen nhat ky, tinh bang giay. */
  @Prop({ type: Number, default: 5, min: 3, max: 10 })
  slideSeconds!: number;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  lastEditedBy!: Types.ObjectId | null;
}

export const BusinessConfigSchema = SchemaFactory.createForClass(BusinessConfig);
