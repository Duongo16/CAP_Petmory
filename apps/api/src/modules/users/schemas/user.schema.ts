import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../../../common/constants/roles';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ type: String, default: null, trim: true })
  phone!: string | null;

  @Prop({ type: String, default: null, trim: true })
  avatarUrl!: string | null;

  @Prop({ type: [String], enum: Role, default: [Role.CUSTOMER] })
  roles!: Role[];

  /**
   * This account's own pet profile limit.
   * Left empty, the shared default from business settings applies.
   */
  @Prop({ type: Number, default: null, min: 0 })
  petProfileLimit!: number | null;

  @Prop({ default: true })
  active!: boolean;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;

  /**
   * Moc phien dang nhap.
   *
   * Moi the ra vao deu mang con so nay. Doi mat khau thi con so tang len,
   * va moi the phat truoc do lap tuc khong con dung duoc nua. Khong co no
   * thi nguoi da chiem tai khoan van o lai ben trong sau khi chu doi mat khau.
   */
  @Prop({ type: Number, default: 1 })
  tokenEpoch!: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
