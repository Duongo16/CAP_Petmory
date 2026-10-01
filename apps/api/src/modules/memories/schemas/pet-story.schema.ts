import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { AiMode } from '../../ai/schemas/ai-usage.schema';

export type PetStoryDocument = HydratedDocument<PetStory>;

/**
 * Giong van cua cau chuyen.
 *
 * Danh sach dong chu khong nhan chu tu do, de mot gia tri la khong the di
 * thang vao loi dan gui cho dich vu ben ngoai.
 */
export enum StoryTone {
  /** Am ap, nhe nhang, ke nhu ke cho ban than nghe. */
  WARM = 'WARM',
  /** Vui tuoi, hom hinh. */
  PLAYFUL = 'PLAYFUL',
  /** Lang dong, dung khi be da di xa. */
  TENDER = 'TENDER',
  /** Ngan gon nhu mot loi de tang. */
  SHORT = 'SHORT',
}

/** Ai da viet ban nay. */
export enum StoryHand {
  /** Do dich vu viet ra. */
  MACHINE = 'MACHINE',
  /** Do nguoi dung sua lai. */
  PERSON = 'PERSON',
}

/**
 * Mot ban cau chuyen ve mot be.
 *
 * Moi lan viet lai sinh mot ban moi chu khong de len ban cu, vi hop dong cho
 * phep nguoi dung luu nhieu ban va so sanh. Ban cu khong bi sua, chi bi an di
 * khi nguoi dung bo.
 */
@Schema({ timestamps: true, collection: 'pet_stories' })
export class PetStory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Pet', required: true, index: true })
  pet!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({ required: true, trim: true, maxlength: 6000 })
  content!: string;

  @Prop({ type: String, enum: StoryTone, default: StoryTone.WARM })
  tone!: StoryTone;

  /** Cac y nguoi dung nhap vao truoc khi xin viet. */
  @Prop({ trim: true, default: '', maxlength: 2000 })
  notes!: string;

  @Prop({ type: String, enum: AiMode, default: AiMode.SAMPLE })
  mode!: AiMode;

  @Prop({ type: String, enum: StoryHand, default: StoryHand.MACHINE })
  hand!: StoryHand;

  /** Ban thu may cua be nay, dem tu mot. */
  @Prop({ type: Number, default: 1, min: 1 })
  version!: number;

  /** Ky niem da gan ban nay vao. Rong khi chua gan. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Memory', default: null })
  attachedMemory!: Types.ObjectId | null;

  @Prop({ default: false, index: true })
  isHidden!: boolean;
}

export const PetStorySchema = SchemaFactory.createForClass(PetStory);
PetStorySchema.index({ owner: 1, pet: 1, isHidden: 1, createdAt: -1 });
