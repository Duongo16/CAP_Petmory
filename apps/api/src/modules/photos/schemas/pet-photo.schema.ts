import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PetPhotoDocument = HydratedDocument<PetPhoto>;

/** Six upload slots by camera angle; the first four are required for a 3D product. */
export enum PhotoAngle {
  /**
   * A picture sent without saying which way the pet was facing.
   *
   * Asking a customer to supply six named angles turned out to be the wrong
   * shape for what people actually do, which is send the photographs they
   * happen to love. This is the value everything sent that way carries.
   */
  GENERAL = 'GENERAL',
  FRONT = 'FRONT',
  LEFT_SIDE = 'LEFT_SIDE',
  RIGHT_SIDE = 'RIGHT_SIDE',
  BACK = 'BACK',
  FACE_CLOSEUP = 'FACE_CLOSEUP',
  FAVOURITE_POSE = 'FAVOURITE_POSE',
}

export const ANGLE_REQUIRED: PhotoAngle[] = [
  PhotoAngle.FRONT,
  PhotoAngle.LEFT_SIDE,
  PhotoAngle.RIGHT_SIDE,
  PhotoAngle.BACK,
];

/** Overall quality label, which decides whether to suggest a restoration. */
export enum QualityLabel {
  GOOD = 'GOOD',
  ACCEPTABLE = 'ACCEPTABLE',
  SHOULD_RESTORE = 'SHOULD_RESTORE',
  UNUSABLE = 'UNUSABLE',
}

@Schema({ _id: false })
export class QualityScore {
  @Prop({ type: Number, required: true })
  width!: number;

  @Prop({ type: Number, required: true })
  height!: number;

  @Prop({ type: Number, required: true })
  shortEdge!: number;

  /** Estimated sharpness. The higher the number, the sharper the photo. */
  @Prop({ type: Number, required: true })
  sharpness!: number;

  /** Average brightness from 0 to 255. */
  @Prop({ type: Number, required: true })
  brightness!: number;

  @Prop({ type: String, enum: QualityLabel, required: true })
  label!: QualityLabel;

  @Prop({ type: [String], default: [] })
  warning!: string[];
}

export const QualityScoreSchema = SchemaFactory.createForClass(QualityScore);

@Schema({ timestamps: true, collection: 'pet_photos' })
export class PetPhoto {
  /*
   * Mot anh co the chua thuoc ve be nao.
   * Nguoi dung co the phuc hoi mot tam anh roi moi quyet dinh gan no vao ho so
   * nao, hoac chi tai ve va khong gan vao dau ca.
   */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Pet', default: null, index: true })
  pet!: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ type: String, enum: PhotoAngle, required: true })
  angle!: PhotoAngle;

  /** File name on disk. The real path is never returned to the client. */
  @Prop({ required: true, trim: true })
  fileName!: string;

  @Prop({ required: true, trim: true })
  originalName!: string;

  @Prop({ required: true, trim: true })
  fileType!: string;

  @Prop({ type: Number, required: true })
  fileSize!: number;

  @Prop({ type: QualityScoreSchema, required: true })
  quality!: QualityScore;

  /** A restored photo points back at its original so the workshop can compare. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'PetPhoto', default: null })
  originalPhoto!: Types.ObjectId | null;

  @Prop({ default: false })
  isRestored!: boolean;

  /**
   * How closely this restored version still resembles the original, from 0 to 100.
   * Only set on a restored version; an original has nothing to compare against.
   */
  @Prop({ type: Number, default: null })
  resemblance!: number | null;

  /** The customer must confirm explicitly before a restored version is used. */
  @Prop({ default: false })
  confirmedByOwner!: boolean;

  @Prop({ default: false, index: true })
  isHidden!: boolean;
}

export const PetPhotoSchema = SchemaFactory.createForClass(PetPhoto);
PetPhotoSchema.index({ pet: 1, isHidden: 1 });
