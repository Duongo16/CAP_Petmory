import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pet, PetDocument, PetStatus } from './schemas/pet.schema';
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
    checkDates(dto.status ?? PetStatus.TOGETHER, dto.birthDate, dto.passedAwayDate);
    checkCameHome(dto.adoptionDate, dto.birthDate);
    return this.model.create({ ...dto, owner: new Types.ObjectId(owner) });
  }

  async update(id: string, dto: UpdatePetDto, owner: string): Promise<PetDocument> {
    const pet = await this.findOwned(id, owner);
    // Kiem tra tren gia tri sau khi gop, vi mot lan sua co the chi doi trang
    // thai ma khong gui lai ngay, hoac nguoc lai.
    checkDates(
      dto.status ?? pet.status,
      dto.birthDate ?? pet.birthDate?.toISOString(),
      dto.passedAwayDate ?? pet.passedAwayDate?.toISOString(),
    );
    checkCameHome(
      dto.adoptionDate ?? pet.adoptionDate?.toISOString(),
      dto.birthDate ?? pet.birthDate?.toISOString(),
    );
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

/**
 * Checks the two dates against each other and against the status.
 *
 * A pet marked as no longer with us has to carry the day that happened, because
 * the memorial engraving on the finished piece is taken from it. The date also
 * cannot come before the pet was born, nor can either one be in the future.
 */
/**
 * The day a pet came home cannot be in days to come, and cannot be before the
 * day it was born.
 */
function checkCameHome(adoptionDate?: string, birthDate?: string): void {
  if (!adoptionDate) {
    return;
  }
  const came = new Date(adoptionDate);
  if (came.getTime() > Date.now()) {
    throw new BadRequestException('Ngay ve nha khong duoc o tuong lai');
  }
  const born = birthDate ? new Date(birthDate) : null;
  if (born && came.getTime() < born.getTime()) {
    throw new BadRequestException('Ngay ve nha phai sau ngay sinh');
  }
}

function checkDates(
  status: PetStatus,
  birthDate: string | undefined,
  passedAwayDate: string | undefined,
): void {
  const now = Date.now();
  const born = birthDate ? new Date(birthDate) : null;
  const gone = passedAwayDate ? new Date(passedAwayDate) : null;

  if (born && born.getTime() > now) {
    throw new BadRequestException('Ngay sinh khong duoc o tuong lai');
  }
  if (status !== PetStatus.PASSED_AWAY) {
    return;
  }
  if (!gone) {
    throw new BadRequestException('Hay cho biet ngay be roi xa');
  }
  if (gone.getTime() > now) {
    throw new BadRequestException('Ngay be roi xa khong duoc o tuong lai');
  }
  if (born && gone.getTime() < born.getTime()) {
    throw new BadRequestException('Ngay be roi xa phai sau ngay sinh');
  }
}
