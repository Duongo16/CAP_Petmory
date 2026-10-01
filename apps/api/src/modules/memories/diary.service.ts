import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Memory, MemoryDocument, MemoryTopic } from './schemas/memory.schema';
import { DiaryShare, DiaryShareDocument } from './schemas/diary-share.schema';
import { Pet, PetDocument } from '../pets/schemas/pet.schema';
import { PetPhoto, PetPhotoDocument } from '../photos/schemas/pet-photo.schema';
import { PetsService } from '../pets/pets.service';
import { StorageService, StorageFolder } from '../../common/storage/storage.service';
import { MSG } from '../../common/constants/messages';

/** Bao nhieu quyen nhat ky hien tren mot trang cua cong dong. */
const PAGE_SIZE = 12;

/** Do dai ma chia se, tinh bang byte truoc khi doi sang chu so muoi sau. */
const CODE_BYTES = 32;

/** Mot quyen nhat ky nhin tu ben ngoai, da bo het du lieu dinh danh. */
export interface DiaryCard {
  petId: string;
  name: string;
  kind: string;
  tagline: string;
  avatarUrl: string;
  momentCount: number;
  lastMomentAt: Date | null;
  ownerName: string;
  slide: { trackCode: string; effect: string; seconds: number };
}

/** Toan bo mot quyen nhat ky cho nguoi doc, kem cac khoanh khac. */
export interface DiaryBook {
  pet: DiaryCard;
  moments: MemoryDocument[];
  photo: PetPhotoDocument[];
}

/**
 * Quyen nhat ky nhin nhu mot chinh the: che do rieng tu, duong dan chia se,
 * va duong doc cho nguoi khong dang nhap.
 *
 * Tach khoi dich vu khoanh khac vi day la chuyen cua ca quyen, khong phai
 * chuyen cua tung khoanh khac, va vi phan lon duong o day khong co nguoi
 * dang nhap nen luat kiem tra cung khac han.
 */
@Injectable()
export class DiaryService {
  constructor(
    @InjectModel(Memory.name) private readonly memoryModel: Model<MemoryDocument>,
    @InjectModel(Pet.name) private readonly petModel: Model<PetDocument>,
    @InjectModel(PetPhoto.name) private readonly photoModel: Model<PetPhotoDocument>,
    @InjectModel(DiaryShare.name) private readonly shareModel: Model<DiaryShareDocument>,
    private readonly pets: PetsService,
    private readonly store: StorageService,
  ) {}

  /**
   * Doc bytes cua mot buc anh nam trong quyen dang de cong khai.
   *
   * Luat o day chi co mot cau: anh nao dang duoc mot khoanh khac cua mot
   * quyen cong khai dung den thi anh do cong khai theo. Anh cua quyen rieng
   * tu, quyen bi an, hoac anh khong khoanh khac nao dung, deu tra ve khong
   * tim thay, khong phan biet ly do.
   */
  async publicPhoto(photoId: string): Promise<{ data: Buffer; fileType: string }> {
    if (!Types.ObjectId.isValid(photoId)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const photo = await this.photoModel.findOne({ _id: photoId, isHidden: false }).exec();
    if (!photo) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const pet = await this.petModel
      .findOne({ _id: photo.pet, isHidden: false, diaryPublic: true, diaryBlocked: false })
      .exec();
    if (!pet) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    /*
     * Anh duoc mot khoanh khac dung den, du la anh gan kem hay anh dan len
     * trang so. Chi dem mot trong hai thi anh dan tren trang se khong hien
     * ra voi nguoi doc, du trang do dang cong khai.
     */
    const usedBy = await this.memoryModel
      .countDocuments({
        pet: pet._id,
        isHidden: false,
        $or: [{ photo: photo._id }, { 'decor.photo': photo._id }],
      })
      .exec();
    if (usedBy === 0) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const data = await this.store.read(StorageFolder.PET, photo.fileName);
    return { data, fileType: photo.fileType };
  }

  /**
   * Bat hoac tat che do cong khai cho mot quyen.
   *
   * Tat che do cong khai thi moi duong dan chia se dang mo bi thu hoi ngay
   * trong cung mot luot, vi neu khong thi quyen da rut ve rieng tu van con
   * doc duoc qua duong dan cu.
   */
  async setPublic(petId: string, owner: string, wanted: boolean): Promise<PetDocument> {
    const pet = await this.pets.findOwned(petId, owner);
    pet.diaryPublic = wanted;
    await pet.save();
    if (!wanted) {
      await this.revokeAll(pet._id);
    }
    return pet;
  }

  /**
   * Quan tri vien an mot quyen khoi cong dong, hoac cho no hien lai.
   *
   * Quyen bi an chi biet mat voi nguoi ngoai. Chu quyen van doc duoc nhat ky
   * cua minh nhu binh thuong, va doc duoc ly do da ghi, vi mat quyen doc do
   * cua minh la hinh phat khong ai giao cho trang nay.
   */
  async blockDiary(petId: string, reason: string, actor: string): Promise<PetDocument> {
    if (!Types.ObjectId.isValid(petId)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const pet = await this.petModel.findOne({ _id: petId, isHidden: false }).exec();
    if (!pet) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    pet.diaryBlocked = true;
    pet.diaryBlockReason = reason;
    pet.diaryBlockedAt = new Date();
    pet.diaryBlockedBy = new Types.ObjectId(actor);
    await pet.save();
    await this.revokeAll(pet._id);
    return pet;
  }

  /** Bo an mot quyen, tra no ve dung che do chu da chon. */
  async unblockDiary(petId: string): Promise<PetDocument> {
    if (!Types.ObjectId.isValid(petId)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const pet = await this.petModel.findOne({ _id: petId, isHidden: false }).exec();
    if (!pet) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    pet.diaryBlocked = false;
    pet.diaryBlockedAt = null;
    pet.diaryBlockedBy = null;
    await pet.save();
    return pet;
  }

  /**
   * Luu cach trinh chieu cho mot quyen.
   *
   * Luu theo quyen chu khong theo may cua nguoi xem, de nguoi cam duong dan
   * chia se cung thay dung cach chu quyen da chon.
   */
  async setSlide(
    petId: string,
    owner: string,
    wanted: { trackCode?: string; effect?: string; seconds?: number },
  ): Promise<PetDocument> {
    const pet = await this.pets.findOwned(petId, owner);
    pet.slideSetting = {
      trackCode: wanted.trackCode ?? pet.slideSetting.trackCode,
      effect: wanted.effect ?? pet.slideSetting.effect,
      seconds: wanted.seconds ?? pet.slideSetting.seconds,
    };
    return pet.save();
  }

  /** Thu hoi toan bo duong dan chia se cua mot quyen. */
  private async revokeAll(petId: Types.ObjectId): Promise<void> {
    await this.shareModel
      .updateMany({ pet: petId, revokedAt: null }, { $set: { revokedAt: new Date() } })
      .exec();
  }

  /**
   * Tao mot duong dan chia se moi.
   *
   * Ma nguyen van chi duoc tra ve dung lan nay. Trong co so du lieu chi con
   * ban bam cua no, nen ke nao doc duoc co so du lieu cung khong mo duoc
   * quyen nhat ky bang nhung gi doc duoc.
   */
  async makeShare(
    petId: string,
    owner: string,
    expiresAt: string | null,
  ): Promise<{ share: DiaryShareDocument; code: string }> {
    const pet = await this.pets.findOwned(petId, owner);
    const code = randomBytes(CODE_BYTES).toString('hex');
    const until = expiresAt ? new Date(expiresAt) : null;
    if (until && until.getTime() <= Date.now()) {
      throw new BadRequestException('Ngay het han phai nam o tuong lai');
    }
    const share = await this.shareModel.create({
      owner: new Types.ObjectId(owner),
      pet: pet._id,
      codeHash: hashOf(code),
      expiresAt: until,
    });
    return { share, code };
  }

  /** Cac duong dan con hieu luc cua mot quyen, khong kem ma. */
  async listShares(petId: string, owner: string): Promise<DiaryShareDocument[]> {
    await this.pets.findOwned(petId, owner);
    return this.shareModel
      .find({ pet: new Types.ObjectId(petId), revokedAt: null })
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Thu hoi mot duong dan, khong dung den cac duong dan con lai. */
  async revokeShare(shareId: string, owner: string): Promise<DiaryShareDocument> {
    if (!Types.ObjectId.isValid(shareId)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const share = await this.shareModel.findById(shareId).exec();
    if (!share || share.owner.toString() !== owner) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    share.revokedAt = new Date();
    return share.save();
  }

  /**
   * Doc mot quyen bang ma chia se.
   *
   * Ma sai, ma da thu hoi, ma het han va quyen da rut ve rieng tu deu tra ve
   * cung mot cau khong tim thay, de nguoi cam ma khong doan duoc quyen do co
   * ton tai hay khong.
   */
  async bookByCode(code: string): Promise<DiaryBook> {
    const share = await this.shareModel
      .findOneAndUpdate(
        {
          codeHash: hashOf(code),
          revokedAt: null,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        },
        { $inc: { viewCount: 1 }, $set: { lastViewedAt: new Date() } },
        { new: true },
      )
      .exec();
    if (!share) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const pet = await this.petModel.findById(share.pet).exec();
    if (!pet || pet.isHidden || !pet.diaryPublic || pet.diaryBlocked) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return this.buildBook(pet);
  }

  /** Doc mot quyen dang de cong khai, khong can dang nhap. */
  async publicBook(petId: string): Promise<DiaryBook> {
    if (!Types.ObjectId.isValid(petId)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const pet = await this.petModel
      .findOne({ _id: petId, isHidden: false, diaryPublic: true, diaryBlocked: false })
      .exec();
    if (!pet) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return this.buildBook(pet);
  }

  /**
   * Danh sach cac quyen dang de cong khai, quyen vua co khoanh khac moi len
   * truoc. Loc duoc theo chu de va tim duoc theo ten be.
   */
  async publicList(
    page: number,
    topic?: MemoryTopic,
    keyword?: string,
  ): Promise<{ rows: DiaryCard[]; total: number; page: number; pageCount: number }> {
    const where: Record<string, unknown> = {
      isHidden: false,
      diaryPublic: true,
      diaryBlocked: false,
    };
    const word = keyword?.trim();
    if (word) {
      where.name = new RegExp(escapeWord(word), 'i');
    }
    const pets = await this.petModel.find(where).exec();
    const cards = await this.cardsOf(pets, topic);
    cards.sort((a, b) => (b.lastMomentAt?.getTime() ?? 0) - (a.lastMomentAt?.getTime() ?? 0));

    /*
     * Loc theo chu de duoc lam sau khi da dem, vi mot quyen chi con lai
     * trong danh sach khi no that su co khoanh khac thuoc chu de do.
     */
    const kept = topic ? cards.filter((one) => one.momentCount > 0) : cards;
    const from = (page - 1) * PAGE_SIZE;
    return {
      rows: kept.slice(from, from + PAGE_SIZE),
      total: kept.length,
      page,
      pageCount: Math.max(1, Math.ceil(kept.length / PAGE_SIZE)),
    };
  }

  /** Dem khoanh khac va lay ten chu cho tung quyen. */
  private async cardsOf(pets: PetDocument[], topic?: MemoryTopic): Promise<DiaryCard[]> {
    if (pets.length === 0) {
      return [];
    }
    const ids = pets.map((one) => one._id);
    const base: Record<string, unknown> = { pet: { $in: ids }, isHidden: false };
    const grouped = await this.memoryModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
      last: Date;
    }>([
      { $match: topic ? { ...base, topic } : base },
      { $group: { _id: '$pet', count: { $sum: 1 }, last: { $max: '$happenedAt' } } },
    ]);
    const tally = new Map(grouped.map((one) => [one._id.toString(), one]));
    const owners = await this.petModel.db
      .collection('users')
      .find({ _id: { $in: pets.map((one) => one.owner) } }, { projection: { fullName: 1 } })
      .toArray();
    const nameOfOwner = new Map(owners.map((one) => [String(one._id), String(one.fullName ?? '')]));

    return pets.map((pet) => {
      const seen = tally.get(pet._id.toString());
      return this.cardOf(pet, seen?.count ?? 0, seen?.last ?? null, nameOfOwner.get(pet.owner.toString()) ?? '');
    });
  }

  /**
   * Mot quyen thu gon cho nguoi ngoai doc.
   *
   * Chi tra ve nhung gi mot nguoi la duoc phep nhin. Ma chip, ten nguoi cham
   * soc va dia chi nha deu la du lieu dinh danh nen khong bao gio ra khoi day.
   */
  private cardOf(pet: PetDocument, momentCount: number, lastMomentAt: Date | null, ownerName: string): DiaryCard {
    return {
      petId: pet._id.toString(),
      name: pet.name,
      kind: pet.kind,
      tagline: pet.tagline,
      avatarUrl: pet.avatarUrl,
      momentCount,
      lastMomentAt,
      ownerName,
      slide: {
        trackCode: pet.slideSetting.trackCode,
        effect: pet.slideSetting.effect,
        seconds: pet.slideSetting.seconds,
      },
    };
  }

  /** Mot quyen day du: the gioi thieu, cac khoanh khac va anh di kem. */
  private async buildBook(pet: PetDocument): Promise<DiaryBook> {
    const moments = await this.memoryModel
      .find({ pet: pet._id, isHidden: false })
      .sort({ happenedAt: -1 })
      .exec();
    const owner = await this.petModel.db
      .collection('users')
      .findOne({ _id: pet.owner }, { projection: { fullName: 1 } });
    const photoIds = [
      ...moments.flatMap((one) => one.photo),
      ...moments.flatMap((one) => one.decor.map((item) => item.photo)),
    ].filter((one): one is Types.ObjectId => Boolean(one));
    const photo = await this.photoModel
      .find({ _id: { $in: photoIds }, isHidden: false })
      .exec();
    const last = moments[0]?.happenedAt ?? null;
    return {
      pet: this.cardOf(pet, moments.length, last, String(owner?.fullName ?? '')),
      moments,
      photo,
    };
  }
}

/** Ban bam cua ma chia se. Ma nguyen van khong bao gio duoc luu lai. */
function hashOf(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** Bo tac dung cua cac ky tu dac biet khi nguoi dung go vao o tim kiem. */
function escapeWord(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
