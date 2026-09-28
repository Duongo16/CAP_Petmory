import {
  BadRequestException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  ANGLE_REQUIRED,
  PhotoAngle,
  QualityLabel,
  PetPhoto,
  PetPhotoDocument,
} from './schemas/pet-photo.schema';
import { RestoreOperation } from './dto/photo.dto';
import { measureResemblance, restorePhoto, scorePhoto } from './image-tool';
import { PetsService } from '../pets/pets.service';
import { BusinessConfigService } from '../business-config/business-config.service';
import { MSG } from '../../common/constants/messages';

/** Accepts three still-image formats only. Video files are rejected outright. */
const ALLOWED_TYPES = new Set(['jpeg', 'jpg', 'png']);
const COUNT_PHOTO_MAX = 20;
const ERROR_FILE_TYPE = 'Chi nhan anh JPG, JPEG hoac PNG';
const KEY_QUOTA_RESTORE = 'restorePhoto';

/** The three quota windows, counted backwards from now. */
const QUOTA_WINDOWS: { name: 'day' | 'month' | 'year'; hours: number }[] = [
  { name: 'day', hours: 24 },
  { name: 'month', hours: 24 * 30 },
  { name: 'year', hours: 24 * 365 },
];

@Injectable()
export class PhotosService {
  private readonly dir: string;

  constructor(
    @InjectModel(PetPhoto.name) private readonly model: Model<PetPhotoDocument>,
    private readonly pets: PetsService,
    private readonly businessConfig: BusinessConfigService,
    config: ConfigService,
  ) {
    this.dir = path.resolve(config.getOrThrow<string>('upload.dir'));
  }

  async listByPet(petId: string, owner: string) {
    await this.pets.findOwned(petId, owner);
    return this.model
      .find({ pet: new Types.ObjectId(petId), isHidden: false })
      .sort({ createdAt: 1 })
      .exec();
  }

  /** Reports which required angles are still missing, so the UI can warn early. */
  async checkRequiredAngles(petId: string, owner: string) {
    const ds = await this.listByPet(petId, owner);
    const daCo = new Set(ds.filter((a) => !a.isRestored).map((a) => a.angle));
    const missing = ANGLE_REQUIRED.filter((g) => !daCo.has(g));
    return { missing, rawAngle: missing.length === 0, countPhoto: ds.length };
  }

  async load(
    petId: string,
    owner: string,
    angle: PhotoAngle,
    file: Express.Multer.File,
  ): Promise<PetPhotoDocument> {
    await this.pets.findOwned(petId, owner);
    const cf = await this.businessConfig.get();

    if (!file?.buffer?.length) {
      throw new BadRequestException('Chua chon tep anh nao');
    }

    if (file.size > cf.maxPhotoSizeMb * 1024 * 1024) {
      throw new BadRequestException(`Anh vuot qua ${cf.maxPhotoSizeMb} MB`);
    }

    const currentCount = await this.model.countDocuments({
      pet: new Types.ObjectId(petId),
      isHidden: false,
    });
    if (currentCount >= COUNT_PHOTO_MAX) {
      throw new BadRequestException(`Moi thu cung chi luu toi da ${COUNT_PHOTO_MAX} anh`);
    }

        // Check the file's real format; the extension sent by the client is not trusted.
        // A non-image file makes the read step fail. That is the caller's mistake,
        // so it returns an input error rather than a server error.
    const { quality, fileType } = await scorePhoto(file.buffer, {
      shortEdgeOk: cf.goodShortEdgePx,
      shortEdgeWarning: cf.warnShortEdgePx,
    }).catch(() => {
      throw new BadRequestException(ERROR_FILE_TYPE);
    });
    if (!ALLOWED_TYPES.has(fileType)) {
      throw new BadRequestException(ERROR_FILE_TYPE);
    }

    const fileName = `${randomUUID()}.${fileType === 'jpeg' ? 'jpg' : fileType}`;
    await this.writeFile(fileName, file.buffer);

    return this.model.create({
      pet: new Types.ObjectId(petId),
      owner: new Types.ObjectId(owner),
      angle,
      fileName,
      originalName: file.originalname,
      fileType,
      fileSize: file.size,
      quality,
    });
  }

  /** Checks ownership on the photo itself, not just the caller's role. */
  async findOwned(codePhoto: string, owner: string): Promise<PetPhotoDocument> {
    if (!Types.ObjectId.isValid(codePhoto)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const photo = await this.model.findOne({ _id: codePhoto, isHidden: false }).exec();
    if (!photo || photo.owner.toString() !== owner) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return photo;
  }

  async readContent(codePhoto: string, owner: string): Promise<{ data: Buffer; fileType: string }> {
    const photo = await this.findOwned(codePhoto, owner);
    const data = await fs.readFile(path.join(this.dir, photo.fileName));
    return { data, fileType: photo.fileType };
  }

  /**
   * Creates a restored version from an original. The original is always kept
   * intact, and the restored version is a new record pointing back at it.
   */
  async restore(
    codePhoto: string,
    owner: string,
    operation: RestoreOperation[],
  ): Promise<PetPhotoDocument> {
    if (operation.length === 0) {
      throw new BadRequestException('Chua chon thao tac nao');
    }
    const angle = await this.findOwned(codePhoto, owner);
    if (angle.isRestored) {
      throw new BadRequestException('Khong phuc hoi tu mot ban da phuc hoi');
    }

    const cf = await this.businessConfig.get();
    await this.checkRestoreQuota(owner, cf.aiQuota?.[KEY_QUOTA_RESTORE]);

    const rawData = await fs.readFile(path.join(this.dir, angle.fileName));
    const dataNext = await restorePhoto(rawData, operation);

    const { quality } = await scorePhoto(dataNext, {
      shortEdgeOk: cf.goodShortEdgePx,
      shortEdgeWarning: cf.warnShortEdgePx,
    });

    // Business rule F3-02: a restoration must not move the pet's features. The
    // score is measured here and travels with the record, so both the customer
    // and the workshop can see it rather than taking the result on trust.
    const resemblance = await measureResemblance(rawData, dataNext);

    const fileName = `${randomUUID()}.png`;
    await this.writeFile(fileName, dataNext);

        // Each original keeps only one active restored version.
    await this.model.updateMany(
      { originalPhoto: angle._id, isHidden: false },
      { $set: { isHidden: true } },
    );

    return this.model.create({
      pet: angle.pet,
      owner: angle.owner,
      angle: angle.angle,
      fileName,
      originalName: angle.originalName,
      fileType: 'png',
      fileSize: dataNext.length,
      quality,
      resemblance,
      originalPhoto: angle._id,
      isRestored: true,
      confirmedByOwner: false,
    });
  }

  /**
   * Compares restorations already used against the quota set by the Manager group.
   * A discarded restoration still counts, because the work was done once either way.
   */
  private async checkRestoreQuota(
    owner: string,
    quota: { day: number; month: number; year: number } | undefined,
  ): Promise<void> {
    if (!quota) {
      return;
    }
    const ownerId = new Types.ObjectId(owner);
    for (const window of QUOTA_WINDOWS) {
      const cap = quota[window.name];
      if (!cap || cap <= 0) {
        continue;
      }
      const since = new Date(Date.now() - window.hours * 60 * 60 * 1000);
      const inUse = await this.model.countDocuments({
        owner: ownerId,
        isRestored: true,
        createdAt: { $gte: since },
      });
      if (inUse >= cap) {
        throw new HttpException(MSG.RESTORE_QUOTA_REACHED, HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }

  /** A restored version is only used after the customer explicitly confirms it. */
  async confirm(codePhoto: string, owner: string, accept: boolean): Promise<PetPhotoDocument> {
    const photo = await this.findOwned(codePhoto, owner);
    if (!photo.isRestored) {
      throw new BadRequestException('Chi xac nhan tren ban phuc hoi');
    }
    if (!accept) {
      photo.isHidden = true;
      return photo.save();
    }
    photo.confirmedByOwner = true;
    return photo.save();
  }

  /** Soft delete. The file is kept so it can be checked if a complaint comes in. */
  async hide(codePhoto: string, owner: string): Promise<PetPhotoDocument> {
    const photo = await this.findOwned(codePhoto, owner);
    photo.isHidden = true;
    return photo.save();
  }

  get labelsNeedingRestore(): QualityLabel[] {
    return [QualityLabel.SHOULD_RESTORE, QualityLabel.UNUSABLE];
  }

  private async writeFile(fileName: string, data: Buffer): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(path.join(this.dir, fileName), data);
  }
}
