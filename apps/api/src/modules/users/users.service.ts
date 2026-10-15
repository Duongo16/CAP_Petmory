import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { Role } from '../../common/constants/roles';
import { MSG } from '../../common/constants/messages';
import { normalizeVietnamesePhone, VIETNAMESE_PHONE } from '../../common/validation/vietnamese-phone';

const HASH_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly model: Model<UserDocument>) {}

  async createNext(input: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    roles?: Role[];
  }): Promise<UserDocument> {
    const alreadyExists = await this.model.exists({ email: input.email.toLowerCase() });
    if (alreadyExists) {
      throw new ConflictException(MSG.EMAIL_TAKEN);
    }
    const phone = input.phone ? normalizeVietnamesePhone(input.phone) : '';
    if (phone && (await this.model.exists({ phone }))) {
      throw new ConflictException(MSG.PHONE_TAKEN);
    }
    const passwordHash = await bcrypt.hash(input.password, HASH_ROUNDS);
    return this.model.create({
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      phone: phone || null,
      passwordHash,
      roles: input.roles ?? [Role.CUSTOMER],
    });
  }

  findByIdentifierWithPassword(identifier: string) {
    const value = identifier.trim();
    const phone = normalizeVietnamesePhone(value);
    const query = VIETNAMESE_PHONE.test(phone) ? { phone } : { email: value.toLowerCase() };
    return this.model.findOne(query).select('+passwordHash').exec();
  }

  findByIdWithPassword(id: string) {
    return this.model.findById(new Types.ObjectId(id)).select('+passwordHash').exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.model.findById(new Types.ObjectId(id)).exec();
    if (!user) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return user;
  }

  checkPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /** Replaces the stored password. The caller must already have proved who they are. */
  async setPassword(id: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, HASH_ROUNDS);
    await this.model.updateOne({ _id: id }, { $set: { passwordHash } }).exec();
  }

  /** Moves the session mark on, which ends every token issued before now. */
  async bumpTokenEpoch(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $inc: { tokenEpoch: 1 } }).exec();
  }

  /** The account behind an address, or nothing. Used where absence must stay quiet. */
  findByEmailQuietly(email: string) {
    return this.model.findOne({ email: email.toLowerCase() }).exec();
  }

  async recordLogin(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } }).exec();
  }

  /** The account's own limit; null means fall back to the shared default. */
  async getOwnLimit(id: string): Promise<number | null> {
    const user = await this.model.findById(id).select('petProfileLimit').exec();
    return user?.petProfileLimit ?? null;
  }
}
