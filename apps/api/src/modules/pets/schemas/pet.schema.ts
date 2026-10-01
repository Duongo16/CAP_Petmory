import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PetDocument = HydratedDocument<Pet>;

/** The pet's status, which changes both the wording and the styling. */
export enum PetStatus {
  TOGETHER = 'TOGETHER',
  PASSED_AWAY = 'PASSED_AWAY',
}

/**
 * The kinds of pet the workshop makes a piece for.
 *
 * This used to be free text, which meant the same animal arrived spelled three
 * different ways and nothing could be counted or filtered. The list is closed
 * so the interface can offer it as a choice.
 */
export enum PetKind {
  DOG = 'DOG',
  CAT = 'CAT',
  RABBIT = 'RABBIT',
  HAMSTER = 'HAMSTER',
  BIRD = 'BIRD',
  OTHER = 'OTHER',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  UNKNOWN = 'UNKNOWN',
}

@Schema({ _id: false })
export class Milestone {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: Date, required: true })
  at!: Date;

  @Prop({ trim: true, default: '' })
  description!: string;
}

export const MilestoneSchema = SchemaFactory.createForClass(Milestone);

/**
 * Someone at home who looks after this pet, and what they do for it.
 * Kept as plain wording rather than a link to an account, because the people
 * who feed and walk a pet are often not the ones holding the account.
 */
@Schema({ _id: false })
export class Carer {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true, default: '' })
  role!: string;
}

export const CarerSchema = SchemaFactory.createForClass(Carer);

/**
 * Cach trinh chieu quyen nhat ky cua mot be.
 *
 * Luu theo tung quyen chu khong theo tung may, de nguoi cam duong dan chia se
 * cung xem duoc dung cach chu quyen da chon.
 */
@Schema({ _id: false })
export class SlideSetting {
  /** Ma bai nhac trong kho cua he thong. De trong la chay khong nhac. */
  @Prop({ trim: true, default: '', maxlength: 60 })
  trackCode!: string;

  /** Kieu chuyen canh: mo dan, truot ngang hoac phong nhe. */
  @Prop({ type: String, enum: ['FADE', 'SLIDE', 'ZOOM'], default: 'FADE' })
  effect!: string;

  /** Moi anh dung bao lau, tinh bang giay. */
  @Prop({ type: Number, default: 5, min: 3, max: 10 })
  seconds!: number;
}

export const SlideSettingSchema = SchemaFactory.createForClass(SlideSetting);

@Schema({ timestamps: true, collection: 'pets' })
export class Pet {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, enum: PetKind, default: PetKind.OTHER })
  kind!: PetKind;

  @Prop({ trim: true, default: '' })
  breed!: string;

  @Prop({ type: String, enum: Gender, default: Gender.UNKNOWN })
  gender!: Gender;

  @Prop({ type: Date, default: null })
  birthDate!: Date | null;

  @Prop({ type: String, enum: PetStatus, default: PetStatus.TOGETHER })
  status!: PetStatus;

  @Prop({ type: Date, default: null })
  passedAwayDate!: Date | null;

  @Prop({ trim: true, default: '' })
  avatarUrl!: string;

  @Prop({ type: [MilestoneSchema], default: [] })
  milestone!: Milestone[];

  /** A short line in the owner's own words, shown under the name. */
  @Prop({ trim: true, default: '', maxlength: 200 })
  tagline!: string;

  /** The day the pet came home, which is often not the day it was born. */
  @Prop({ type: Date, default: null })
  adoptionDate!: Date | null;

  /** The identifying chip, kept as written since formats differ by country. */
  @Prop({ trim: true, default: '', maxlength: 40 })
  microchip!: string;

  @Prop({ type: Boolean, default: false })
  neutered!: boolean;

  /** Short notes on what the pet is like, one habit or liking each. */
  @Prop({ type: [String], default: [] })
  trait!: string[];

  @Prop({ type: [CarerSchema], default: [] })
  carer!: Carer[];

  /**
   * Quyen nhat ky cua be nay co cho nguoi ngoai doc khong.
   *
   * Dat o muc tung be chu khong tung khoanh khac, va mac dinh la khong, vi
   * nhat ky la chuyen rieng cua mot nha cho den khi chu quyet dinh khac.
   */
  @Prop({ type: Boolean, default: false, index: true })
  diaryPublic!: boolean;

  /** Quan tri vien da an quyen nay khoi cong dong hay chua. */
  @Prop({ type: Boolean, default: false, index: true })
  diaryBlocked!: boolean;

  /** Ly do an, bat buoc phai co, va chu quyen duoc doc lai. */
  @Prop({ trim: true, default: '', maxlength: 500 })
  diaryBlockReason!: string;

  @Prop({ type: Date, default: null })
  diaryBlockedAt!: Date | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  diaryBlockedBy!: Types.ObjectId | null;

  /** Cach trinh chieu quyen nhat ky cua be nay. */
  @Prop({ type: SlideSettingSchema, default: () => ({}) })
  slideSetting!: SlideSetting;

  /** Soft delete, per the rule that business data is never hard deleted. */
  @Prop({ default: false, index: true })
  isHidden!: boolean;

  @Prop({ type: Date, default: null })
  hiddenAt!: Date | null;
}

export const PetSchema = SchemaFactory.createForClass(Pet);
PetSchema.index({ owner: 1, isHidden: 1 });
/* Trang cong dong doc theo chi muc nay: quyen cong khai, chua bi an, con song. */
PetSchema.index({ diaryPublic: 1, diaryBlocked: 1, isHidden: 1 });
