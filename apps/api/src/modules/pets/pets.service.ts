import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pet, PetDocument, PetKind, PetStatus } from './schemas/pet.schema';
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
    const status = dto.status ?? PetStatus.TOGETHER;
    const kind = dto.kind ?? PetKind.OTHER;
    // A memorial day only has meaning for a pet marked as passed away. Keeping
    // it null here also prevents stale form values from being stored on create.
    const passedAwayDate =
      status === PetStatus.PASSED_AWAY ? dto.passedAwayDate : null;
    checkDates(status, dto.birthDate, passedAwayDate, kind);
    checkCameHome(dto.adoptionDate, dto.birthDate);
    return this.model.create({
      ...dto,
      kind,
      status,
      passedAwayDate,
      owner: new Types.ObjectId(owner),
    });
  }

  async update(
    id: string,
    dto: UpdatePetDto,
    owner: string,
  ): Promise<PetDocument> {
    const pet = await this.findOwned(id, owner);
    // Kiem tra tren gia tri sau khi gop, vi mot lan sua co the chi doi trang
    // thai ma khong gui lai ngay, hoac nguoc lai. Do not use ?? here: null is
    // an intentional request to clear an optional date.
    const status = dto.status ?? pet.status;
    const kind = dto.kind ?? pet.kind;
    const birthDate =
      dto.birthDate === undefined
        ? pet.birthDate?.toISOString()
        : dto.birthDate;
    const adoptionDate =
      dto.adoptionDate === undefined
        ? pet.adoptionDate?.toISOString()
        : dto.adoptionDate;
    const passedAwayDate =
      status === PetStatus.PASSED_AWAY
        ? dto.passedAwayDate === undefined
          ? pet.passedAwayDate?.toISOString()
          : dto.passedAwayDate
        : null;
    checkDates(status, birthDate, passedAwayDate, kind);
    checkCameHome(adoptionDate, birthDate);
    pet.set({ ...dto, kind, status, passedAwayDate });
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
      throw new ForbiddenException(
        `${MSG.PET_LIMIT_REACHED} (toi da ${limit})`,
      );
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
/**
 * A profile for a dog needs a plausible birth date. This is a data-entry rule
 * requested for this species only; it does not claim that 30 years is a dog's
 * average or maximum lifespan, and it is deliberately not applied to birds or
 * other long-lived pets.
 */
const MAX_DOG_PROFILE_AGE_YEARS = 30;
const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

type DateInput = string | null | undefined;

/** A date-only calendar value. It is deliberately never compared as an instant. */
interface CalendarDay {
  value: string;
}

function checkCameHome(adoptionDate: DateInput, birthDate: DateInput): void {
  if (!adoptionDate) {
    return;
  }
  const came = calendarDay(adoptionDate, 'Ngay ve nha');
  if (came.value > todayCalendarDay()) {
    throw new BadRequestException('Ngay ve nha khong duoc o tuong lai');
  }
  const born = birthDate ? calendarDay(birthDate, 'Ngay sinh') : null;
  if (born && came.value < born.value) {
    throw new BadRequestException('Ngay ve nha phai sau ngay sinh');
  }
}

function checkDates(
  status: PetStatus,
  birthDate: DateInput,
  passedAwayDate: DateInput,
  kind: PetKind,
): void {
  const today = todayCalendarDay();
  const born = birthDate ? calendarDay(birthDate, 'Ngay sinh') : null;
  const gone = passedAwayDate
    ? calendarDay(passedAwayDate, 'Ngay be roi xa')
    : null;

  if (born && born.value > today) {
    throw new BadRequestException('Ngay sinh khong duoc o tuong lai');
  }
  if (
    kind === PetKind.DOG &&
    born &&
    born.value < calendarDayYearsAgo(MAX_DOG_PROFILE_AGE_YEARS)
  ) {
    throw new BadRequestException(
      `Ngay sinh cua cho khong duoc qua ${MAX_DOG_PROFILE_AGE_YEARS} nam truoc`,
    );
  }
  if (status !== PetStatus.PASSED_AWAY) {
    return;
  }
  if (!gone) {
    throw new BadRequestException('Hay cho biet ngay be roi xa');
  }
  if (gone.value > today) {
    throw new BadRequestException('Ngay be roi xa khong duoc o tuong lai');
  }
  if (born && gone.value < born.value) {
    throw new BadRequestException('Ngay be roi xa phai sau ngay sinh');
  }
}

/**
 * Parses only the calendar part of a date. Comparing a YYYY-MM-DD string keeps
 * the validation independent of UTC conversion around midnight in Vietnam.
 */
function calendarDay(input: string, label: string): CalendarDay {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(input);
  if (!match) {
    throw new BadRequestException(`${label} khong hop le`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${label} khong hop le`);
  }
  return { value: `${match[1]}-${match[2]}-${match[3]}` };
}

/** Returns today's Vietnamese business day rather than the server's UTC day. */
function todayCalendarDay(now = new Date()): string {
  const { year, month, day } = vietnamCalendarParts(now);
  return calendarDayString(year, month, day);
}

/** The earliest permitted birth day under the profile data-entry policy. */
function calendarDayYearsAgo(years: number, now = new Date()): string {
  const { year, month, day } = vietnamCalendarParts(now);
  return calendarDayString(year - years, month, day);
}

function calendarDayString(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function vietnamCalendarParts(now: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}
