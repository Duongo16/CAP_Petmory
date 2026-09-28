import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pet, PetDocument } from './schemas/pet.schema';
import { CreatePetDto, UpdatePetDto } from './dto/pet.dto';
import { MSG } from '../../common/constants/messages';
import { UsersService } from '../users/users.service';
import { BusinessConfigService } from '../business-config/business-config.service';

@Injectable()
export class PetsService {
  constructor(
    @InjectModel(Pet.name) private readonly model: Model<PetDocument>,
    private readonly users: UsersService,
    private readonly config: BusinessConfigService,
  ) {}

  listMine(owner: string) {
    return this.listByOwner(owner);
  }

  /** Lists one owner's pet profiles, used by the internal operations screens. */
  listByOwner(owner: string) {
    return this.model
      .find({ owner: new Types.ObjectId(owner), isHidden: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Checks ownership on the resource itself, not just the caller's role.
   * A non-owner gets not-found, so the record's existence is not revealed.
   */
  async findOwned(id: string, owner: string): Promise<PetDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const pet = await this.model.findOne({ _id: id, isHidden: false }).exec();
    if (!pet) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    if (pet.owner.toString() !== owner) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return pet;
  }

  async create(dto: CreatePetDto, owner: string): Promise<PetDocument> {
    await this.checkQuota(owner);
    return this.model.create({ ...dto, owner: new Types.ObjectId(owner) });
  }

  async update(id: string, dto: UpdatePetDto, owner: string): Promise<PetDocument> {
    const pet = await this.findOwned(id, owner);
    pet.set(dto);
    return pet.save();
  }

  /** Soft delete, per the rule that business data is never hard deleted. */
  async hide(id: string, owner: string): Promise<PetDocument> {
    const pet = await this.findOwned(id, owner);
    pet.isHidden = true;
    pet.hiddenAt = new Date();
    return pet.save();
  }

  /**
   * Two-tier limit: the account's own value if it has one, otherwise the shared
   * default. Only active profiles count towards it.
   */
  private async checkQuota(owner: string): Promise<void> {
    const ownLimit = await this.users.getOwnLimit(owner);
    const limit = ownLimit ?? (await this.config.get()).defaultPetProfileLimit;
    const currentCount = await this.model.countDocuments({
      owner: new Types.ObjectId(owner),
      isHidden: false,
    });
    if (currentCount >= limit) {
      throw new ForbiddenException(`${MSG.PET_LIMIT_REACHED} (toi da ${limit})`);
    }
  }
}
