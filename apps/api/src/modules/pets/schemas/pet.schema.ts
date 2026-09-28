import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PetDocument = HydratedDocument<Pet>;

/** The pet's status, which changes both the wording and the styling. */
export enum PetStatus {
  TOGETHER = 'TOGETHER',
  PASSED_AWAY = 'PASSED_AWAY',
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

@Schema({ timestamps: true, collection: 'pets' })
export class Pet {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true, default: '' })
  kind!: string;

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

  /** Soft delete, per the rule that business data is never hard deleted. */
  @Prop({ default: false, index: true })
  isHidden!: boolean;

  @Prop({ type: Date, default: null })
  hiddenAt!: Date | null;
}

export const PetSchema = SchemaFactory.createForClass(Pet);
PetSchema.index({ owner: 1, isHidden: 1 });
