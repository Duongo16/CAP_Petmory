import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Memory, MemoryDocument, MemoryTopic } from './schemas/memory.schema';
import { PetPhoto, PetPhotoDocument } from '../photos/schemas/pet-photo.schema';
import { CreateMemoryDto, UpdateMemoryDto } from './dto/memory.dto';
import { MSG } from '../../common/constants/messages';
import { PetsService } from '../pets/pets.service';

/** How many moments one page of the diary holds. */
const PAGE_SIZE = 20;

/** How many moments the daily summary looks back over. */
const RECENT_LIMIT = 5;

/** How close to the same day of an earlier year a moment must fall. */
const FLASHBACK_WINDOW_DAYS = 3;

const DAY_MS = 86_400_000;

export interface DiaryPage {
  rows: MemoryDocument[];
  total: number;
  page: number;
  pageCount: number;
  countByTopic: Record<string, number>;
  /** How many of this pet's moments were marked worth remembering. */
  milestoneCount: number;
}

@Injectable()
export class MemoriesService {
  constructor(
    @InjectModel(Memory.name) private readonly model: Model<MemoryDocument>,
    @InjectModel(PetPhoto.name) private readonly photoModel: Model<PetPhotoDocument>,
    private readonly pets: PetsService,
  ) {}

  /**
   * Chi cho gan nhung buc anh dang nam trong album cua chinh be do.
   *
   * Khong kiem o day thi mot nguoi co the gan anh cua nha khac vao khoanh
   * khac cua minh roi dat quyen o che do cong khai, va anh rieng cua nguoi
   * ta se hien ra cho ca thien ha.
   */
  private async checkPhotoOfPet(petId: string, photo?: string[]): Promise<Types.ObjectId[]> {
    const wanted = photo ?? [];
    if (wanted.length === 0) {
      return [];
    }
    const ids = wanted.map((one) => new Types.ObjectId(one));
    const found = await this.photoModel
      .countDocuments({ _id: { $in: ids }, pet: new Types.ObjectId(petId), isHidden: false })
      .exec();
    if (found !== new Set(wanted).size) {
      throw new BadRequestException('Chi gan duoc anh dang nam trong album cua chinh be do');
    }
    return ids;
  }

  /**
   * One page of a pet's diary, newest moment first.
   *
   * The pet is checked against the caller before anything is read, so a moment
   * belonging to someone else is never reachable by guessing an identifier.
   */
  async listForPet(
    petId: string,
    owner: string,
    page = 1,
    topic?: MemoryTopic,
  ): Promise<DiaryPage> {
    await this.pets.findOwned(petId, owner);
    const base: Record<string, unknown> = { pet: new Types.ObjectId(petId), isHidden: false };
    const filter: Record<string, unknown> = topic ? { ...base, topic } : base;

    const [rows, total, grouped, milestoneCount] = await Promise.all([
      this.model
        .find(filter)
        .sort({ happenedAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .exec(),
      this.model.countDocuments(filter).exec(),
      this.model.aggregate<{ _id: string; count: number }>([
        { $match: base },
        { $group: { _id: '$topic', count: { $sum: 1 } } },
      ]),
      this.model.countDocuments({ ...base, isMilestone: true }).exec(),
    ]);

    const countByTopic: Record<string, number> = {};
    for (const one of grouped) {
      countByTopic[one._id] = one.count;
    }

    return {
      rows,
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      countByTopic,
      milestoneCount,
    };
  }

  /** The newest moments across every pet the caller keeps. */
  recent(owner: string): Promise<MemoryDocument[]> {
    return this.model
      .find({ owner: new Types.ObjectId(owner), isHidden: false })
      .sort({ happenedAt: -1 })
      .limit(RECENT_LIMIT)
      .exec();
  }

  /**
   * A moment from an earlier year that falls near today's date.
   *
   * Comparing only the day and month is done in the query language of dates
   * rather than by reading every moment into memory, so the work stays with
   * the database however long the diary grows.
   */
  async onThisDay(owner: string): Promise<MemoryDocument | null> {
    const today = new Date();
    const found = await this.model.aggregate<MemoryDocument>([
      {
        $match: {
          owner: new Types.ObjectId(owner),
          isHidden: false,
          happenedAt: { $lt: new Date(today.getTime() - FLASHBACK_WINDOW_DAYS * DAY_MS) },
        },
      },
      {
        $addFields: {
          apart: {
            $abs: {
              $subtract: [
                { $dayOfYear: '$happenedAt' },
                { $dayOfYear: today },
              ],
            },
          },
        },
      },
      { $match: { apart: { $lte: FLASHBACK_WINDOW_DAYS } } },
      { $sort: { apart: 1, happenedAt: -1 } },
      { $limit: 1 },
    ]);
    return found[0] ?? null;
  }

  async findOwned(id: string, owner: string): Promise<MemoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const one = await this.model.findOne({ _id: id, isHidden: false }).exec();
    if (!one || one.owner.toString() !== owner) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return one;
  }

  async create(dto: CreateMemoryDto, owner: string): Promise<MemoryDocument> {
    await this.pets.findOwned(dto.pet, owner);
    const photo = await this.checkPhotoOfPet(dto.pet, dto.photo);
    await this.checkPhotoOfPet(dto.pet, photoInDecor(dto.decor));
    return this.model.create({
      ...dto,
      owner: new Types.ObjectId(owner),
      pet: new Types.ObjectId(dto.pet),
      photo,
      tag: cleanTags(dto.tag),
    });
  }

  async update(id: string, dto: UpdateMemoryDto, owner: string): Promise<MemoryDocument> {
    const one = await this.findOwned(id, owner);
    const photo = dto.photo
      ? await this.checkPhotoOfPet(one.pet.toString(), dto.photo)
      : null;
    if (dto.decor) {
      await this.checkPhotoOfPet(one.pet.toString(), photoInDecor(dto.decor));
    }
    /*
     * Chi ghi de nhung o that su duoc gui len.
     *
     * Truoc day ca goi duoc do thang vao ban ghi, nen mot yeu cau sua chi
     * mang theo vai o se xoa sach cac o con lai: tieu de va ngay thang bien
     * mat va ban ghi khong luu duoc nua.
     */
    one.set(onlyGiven({
      ...dto,
      ...(photo ? { photo } : {}),
      ...(dto.tag ? { tag: cleanTags(dto.tag) } : {}),
    }));
    return one.save();
  }

  /** Soft delete, per the rule that business data is never hard deleted. */
  async hide(id: string, owner: string): Promise<MemoryDocument> {
    const one = await this.findOwned(id, owner);
    one.isHidden = true;
    one.hiddenAt = new Date();
    return one.save();
  }

}

/** Bo cac o khong duoc gui len, de chung khong xoa mat gia tri dang co. */
function onlyGiven(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (value !== undefined) {
      out[name] = value;
    }
  }
  return out;
}

/**
 * Cac buc anh duoc dat len trang so.
 *
 * Anh dat len trang cung phai la anh cua chinh be do, y het anh gan vao
 * khoanh khac, nen chung duoc kiem bang cung mot phep kiem.
 */
function photoInDecor(decor?: { photo?: string }[]): string[] {
  return (decor ?? [])
    .map((one) => one.photo)
    .filter((one): one is string => Boolean(one));
}

/** Trims each word, drops the empties and keeps each one only once. */
function cleanTags(tags?: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags ?? []) {
    const word = raw.trim().replace(/^#/, '');
    if (word) {
      seen.add(word);
    }
  }
  return [...seen];
}
