import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PasswordResetDocument = HydratedDocument<PasswordReset>;

/**
 * One request to set a new password.
 *
 * The code sent by email is never stored as it was sent. Only its hash is
 * kept, exactly as a password is, so that someone reading this collection
 * still cannot take over an account.
 */
@Schema({ timestamps: true, collection: 'password_resets' })
export class PasswordReset {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  /** The hash of the code that went out in the message. */
  @Prop({ required: true })
  codeHash!: string;

  // Chi muc tu xoa khai bao rieng ben duoi. Them index o day se tao chi muc
  // thuong trung khoa, va tuy chon tu xoa khong con duoc ap dung.
  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  /** Set the moment the code is spent, so it can never be spent twice. */
  @Prop({ type: Date, default: null })
  usedAt!: Date | null;
}

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);

/*
 * Cac yeu cau da qua han duoc co so du lieu tu don sau mot ngay. Giu lai
 * khong de lam gi, ma cang giu thi cang nhieu thu de mat.
 */
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });
PasswordResetSchema.index({ owner: 1, usedAt: 1 });
