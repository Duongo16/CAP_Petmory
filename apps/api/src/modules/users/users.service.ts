import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { Role } from '../../common/constants/roles';
import { MSG } from '../../common/constants/messages';

const HASH_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly model: Model<UserDocument>) {}

  async createNext(input: {
    email: string;
    password: string;
    fullName: string;
    roles?: Role[];
  }): Promise<UserDocument> {
    const alreadyExists = await this.model.exists({ email: input.email.toLowerCase() });
    if (alreadyExists) {
      throw new ConflictException(MSG.EMAIL_TAKEN);
    }
    const passwordHash = await bcrypt.hash(input.password, HASH_ROUNDS);
    return this.model.create({
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      passwordHash,
      roles: input.roles ?? [Role.CUSTOMER],
    });
  }

  findByEmailWithPassword(email: string) {
    return this.model.findOne({ email: email.toLowerCase() }).select('+passwordHash').exec();
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

  async recordLogin(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } }).exec();
  }

  /** The account's own limit; null means fall back to the shared default. */
  async getOwnLimit(id: string): Promise<number | null> {
    const user = await this.model.findById(id).select('petProfileLimit').exec();
    return user?.petProfileLimit ?? null;
  }
}
