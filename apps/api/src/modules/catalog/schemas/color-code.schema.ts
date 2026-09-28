import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ColorCodeDocument = HydratedDocument<ColorCode>;

/** What the colour is for, so fur shades are not offered for accessories. */
export enum ColorGroup {
  FUR = 'FUR',
  EYES_NOSE = 'EYES_NOSE',
  ACCESSORY = 'ACCESSORY',
}

@Schema({ timestamps: true, collection: 'color_codes' })
export class ColorCode {
  /** The colour code is the bridge between the screen and a real wool roll in the store. */
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  code!: string;

  @Prop({ required: true, trim: true })
  displayName!: string;

  /** The swatch shown on screen, purely so the customer can picture it. */
  @Prop({ required: true, trim: true })
  swatch!: string;

  @Prop({ type: String, enum: ColorGroup, required: true, index: true })
  group!: ColorGroup;

  @Prop({ trim: true, default: '' })
  note!: string;

  @Prop({ default: true, index: true })
  enabled!: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder!: number;
}

export const ColorCodeSchema = SchemaFactory.createForClass(ColorCode);
