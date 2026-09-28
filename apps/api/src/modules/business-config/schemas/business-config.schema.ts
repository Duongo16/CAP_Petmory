import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BusinessConfigDocument = HydratedDocument<BusinessConfig>;

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

  @Prop({ type: Object, default: { restorePhoto: { day: 20, month: 300, year: 3000 } } })
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

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  lastEditedBy!: Types.ObjectId | null;
}

export const BusinessConfigSchema = SchemaFactory.createForClass(BusinessConfig);
