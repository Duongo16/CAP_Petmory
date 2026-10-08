import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type DesignDocument = HydratedDocument<Design>;

/** The six standard preview angles, matching the cameras in the 3D viewer. */
export enum PreviewAngle {
  FRONT = 'FRONT',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  BACK = 'BACK',
  TOP = 'TOP',
  ISO = 'ISO',
}

export const ANGLES_PREVIEW: PreviewAngle[] = [
  PreviewAngle.FRONT,
  PreviewAngle.LEFT,
  PreviewAngle.RIGHT,
  PreviewAngle.BACK,
  PreviewAngle.TOP,
  PreviewAngle.ISO,
];

/**
 * The painted colours of one mesh in the model.
 *
 * Colours are stored as one long string: every six characters is one face, in
 * mesh face order. This is far more compact than an object per face, and it
 * reads back exactly face by face when a draft is reopened.
 */
@Schema({ _id: false })
export class MeshPaint {
  @Prop({ required: true, trim: true })
  mesh!: string;

  @Prop({ required: true })
  color!: string;
}

export const MeshPaintSchema = SchemaFactory.createForClass(MeshPaint);

/**
 * Mau cua mot vung co ten tren mo hinh.
 *
 * Khach to tu do tung mat luoi, nhung xuong pha len theo vung: long chu dao
 * mot mau, long bung mot mau, tai mot mau. Lop nay la cai noi giua hai cach
 * nhin do, va la thu ho so san xuat doc de ghi ma mau tung vung.
 */
@Schema({ _id: false })
export class ZonePaint {
  /** Ten vung, lay tu danh sach sau vung co ten cua ban khai mo hinh. */
  @Prop({ required: true, trim: true, maxlength: 30 })
  zone!: string;

  /** Ma mau trong bang mau len. */
  @Prop({ required: true, trim: true, maxlength: 30 })
  colorCode!: string;
}

export const ZonePaintSchema = SchemaFactory.createForClass(ZonePaint);

/** Text engraved on the product. */
@Schema({ _id: false })
export class Engraving {
  @Prop({ trim: true, default: '' })
  name!: string;

  @Prop({ type: Date, default: null })
  memorialDate!: Date | null;

  @Prop({ trim: true, default: '' })
  message!: string;
}

export const EngravingSchema = SchemaFactory.createForClass(Engraving);

/** Mau go cua de trung bay. */
export enum StandTone {
  OAK = 'OAK',
  WALNUT = 'WALNUT',
  CHERRY = 'CHERRY',
  BIRCH = 'BIRCH',
  PINK = 'PINK',
  MINT = 'MINT',
}

/** Do trang tri bang len dat tren de, quanh chan be. */
export enum StandDecoration {
  FLOWERS = 'FLOWERS',
  HEART = 'HEART',
  BONE = 'BONE',
  FISH = 'FISH',
  YARN_BALL = 'YARN_BALL',
  MUSHROOM = 'MUSHROOM',
}

/** Moi de co bon cho dat do trang tri. */
export const STAND_DECORATION_MAX = 4;

/**
 * De trung bay khach chon cho ban thiet ke.
 *
 * Ma de tro toi danh muc de cua cua hang, noi co gia; mau go va do trang tri
 * di kem khong tinh them tien. Chu khac tren de lay tu phan khac chu.
 */
@Schema({ _id: false })
export class Stand {
  @Prop({ trim: true, uppercase: true, default: '' })
  baseCode!: string;

  @Prop({ type: String, enum: StandTone, default: StandTone.OAK })
  tone!: StandTone;

  @Prop({ type: [String], enum: StandDecoration, default: [] })
  decorations!: StandDecoration[];
}

export const StandSchema = SchemaFactory.createForClass(Stand);

@Schema({ _id: false })
export class Preview {
  @Prop({ type: String, enum: PreviewAngle, required: true })
  angle!: PreviewAngle;

  @Prop({ required: true, trim: true })
  fileName!: string;
}

export const PreviewImageSchema = SchemaFactory.createForClass(Preview);

/**
 * A product design. The customer can save it and keep editing, and when an order
 * is placed the design travels with it so the workshop knows what to make.
 */
@Schema({ timestamps: true, collection: 'designs' })
export class Design {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  /** Base model code, matching the file name in the model library. */
  @Prop({ required: true, trim: true })
  modelCode!: string;

  @Prop({ type: [MeshPaintSchema], default: [] })
  paint!: MeshPaint[];

  /** The wool colour codes the customer used, so the workshop knows which rolls to pull. */
  @Prop({ type: [String], default: [] })
  colorCodesUsed!: string[];

  /**
   * Mau cua tung vung co ten.
   *
   * Rong voi cac ban thiet ke cu, va voi nhung mo hinh chua tach du vung.
   * Ho so san xuat doc day truoc, chi khi khong co gi moi quay ve liet ke
   * theo bang ma mau chung.
   */
  @Prop({ type: [ZonePaintSchema], default: [] })
  zonePaint!: ZonePaint[];

  @Prop({ trim: true, uppercase: true, default: '' })
  productTypeCode!: string;

  @Prop({ trim: true, uppercase: true, default: '' })
  sizeCode!: string;

  @Prop({ type: EngravingSchema, default: () => ({}) })
  engraving!: Engraving;

  @Prop({ type: StandSchema, default: () => ({}) })
  stand!: Stand;

  /** Ma phu kien da gan len mau, moi diem neo mot mon. */
  @Prop({ type: [String], default: [] })
  accessories!: string[];

  /** Dac diem rieng cua be do khach ghi, de xuong lam dung (muc 11). */
  @Prop({ trim: true, default: '', maxlength: 500 })
  featureNote!: string;

  /**
   * Dac diem AI doc duoc tu anh cua be, chi de xuong tham khao.
   *
   * Khach chi bat buoc gui anh chinh dien, nen phan lung va duoi co the la do
   * AI doan; doan nao cung duoc ghi ro la doan.
   */
  @Prop({ trim: true, default: '', maxlength: 1000 })
  aiNote!: string;

  @Prop({ type: [PreviewImageSchema], default: [] })
  preview!: Preview[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Pet', default: null })
  pet!: Types.ObjectId | null;

  @Prop({ default: false, index: true })
  isHidden!: boolean;
}

export const DesignSchema = SchemaFactory.createForClass(Design);
DesignSchema.index({ owner: 1, isHidden: 1 });
