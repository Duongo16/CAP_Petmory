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

  @Prop({ trim: true, uppercase: true, default: '' })
  productTypeCode!: string;

  @Prop({ trim: true, uppercase: true, default: '' })
  sizeCode!: string;

  @Prop({ type: EngravingSchema, default: () => ({}) })
  engraving!: Engraving;

  @Prop({ type: [PreviewImageSchema], default: [] })
  preview!: Preview[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Pet', default: null })
  pet!: Types.ObjectId | null;

  @Prop({ default: false, index: true })
  isHidden!: boolean;
}

export const DesignSchema = SchemaFactory.createForClass(Design);
DesignSchema.index({ owner: 1, isHidden: 1 });
