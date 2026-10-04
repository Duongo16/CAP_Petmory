import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import {
  ANGLES_PREVIEW,
  Design,
  DesignDocument,
  PreviewAngle,
  StandTone,
} from './schemas/design.schema';
import { SaveDesignDto, COUNT_DESIGN_MAX } from './dto/design.dto';
import { CatalogService } from '../catalog/catalog.service';
import { MSG } from '../../common/constants/messages';
import { StorageFolder, StorageService } from '../../common/storage/storage.service';

/** Preview images are drawn by the browser, always in a lossless raster format. */
const TYPE_PREVIEW = 'png';
const EDGE_MAX = 1600;
const FILE_SIZE_MAX = 4 * 1024 * 1024;

@Injectable()
export class DesignsService {

  constructor(
    @InjectModel(Design.name) private readonly model: Model<DesignDocument>,
    private readonly catalog: CatalogService,
    private readonly storage: StorageService,
  ) {}

  listMine(owner: string) {
    return this.model
      .find({ owner: new Types.ObjectId(owner), isHidden: false })
      .sort({ updatedAt: -1 })
      .exec();
  }

  /** Checks ownership on the design itself, not just the caller's role. */
  async findOwned(id: string, owner: string): Promise<DesignDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const tk = await this.model.findOne({ _id: id, isHidden: false }).exec();
    if (!tk || tk.owner.toString() !== owner) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return tk;
  }

  async create(owner: string, dto: SaveDesignDto): Promise<DesignDocument> {
    const currentCount = await this.model.countDocuments({
      owner: new Types.ObjectId(owner),
      isHidden: false,
    });
    if (currentCount >= COUNT_DESIGN_MAX) {
      throw new BadRequestException(`Moi tai khoan chi luu toi da ${COUNT_DESIGN_MAX} ban thiet ke`);
    }
    await this.checkProduct(dto);
    return this.model.create({
      ...this.prepare(dto),
      owner: new Types.ObjectId(owner),
    });
  }

  async update(id: string, owner: string, dto: SaveDesignDto): Promise<DesignDocument> {
    const tk = await this.findOwned(id, owner);
    await this.checkProduct(dto);
    tk.set(this.prepare(dto));
    return tk.save();
  }

  /** Soft delete: the record is kept in case the customer disputes a placed order. */
  async hide(id: string, owner: string): Promise<DesignDocument> {
    const tk = await this.findOwned(id, owner);
    tk.isHidden = true;
    return tk.save();
  }

  /**
   * The quote is read from the catalog on the server.
   * A price sent by the browser is never trusted.
   */
  async quote(productTypeCode: string, sizeCode: string) {
    const kind = await this.catalog.detailProductType(productTypeCode);
    const size = kind.sizes.find((s) => s.code === sizeCode.toUpperCase() && s.enabled);
    if (!size) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return {
      productTypeCode: kind.code,
      nameProductType: kind.name,
      sizeCode: size.code,
      sizeName: size.displayName,
      dimensions: size.dimensions,
      unitPrice: size.price.toString(),
      currency: size.currency,
      productionDays: size.productionDays,
      minPhotos: size.minPhotos,
    };
  }

  async savePreview(
    id: string,
    owner: string,
    angle: PreviewAngle,
    file: Express.Multer.File,
  ): Promise<DesignDocument> {
    const tk = await this.findOwned(id, owner);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Chua chon tep anh nao');
    }
    if (file.size > FILE_SIZE_MAX) {
      throw new BadRequestException('Anh xem truoc vuot qua dung luong cho phep');
    }

    const info = await sharp(file.buffer, { failOn: 'none' })
      .metadata()
      .catch(() => {
        throw new BadRequestException('Tep gui len khong phai anh');
      });
    if (info.format !== TYPE_PREVIEW) {
      throw new BadRequestException('Anh xem truoc phai o dinh dang PNG');
    }
    if ((info.width ?? 0) > EDGE_MAX || (info.height ?? 0) > EDGE_MAX) {
      throw new BadRequestException('Anh xem truoc vuot qua kich thuoc cho phep');
    }

    const fileName = `tk-${randomUUID()}.png`;
    await this.storage.save(StorageFolder.DESIGN, fileName, file.buffer, 'image/png');

    /*
     * Moi goc chi giu mot anh. Trinh duyet gui sau goc cung luc, nen phai thay
     * anh trong mot lenh cap nhat duy nhat tren may chu co so du lieu. Doc ra,
     * sua roi luu lai thi cac lan gui song song se giam len nhau va bao loi.
     */
    const updated = await this.model
      .findOneAndUpdate(
        { _id: tk._id, owner: tk.owner, isHidden: false },
        [
          {
            $set: {
              preview: {
                $concatArrays: [
                  { $filter: { input: '$preview', cond: { $ne: ['$$this.angle', angle] } } },
                  [{ angle, fileName }],
                ],
              },
            },
          },
        ],
        { new: true, updatePipeline: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return updated;
  }

  async readPreview(id: string, owner: string, angle: PreviewAngle): Promise<Buffer> {
    const tk = await this.findOwned(id, owner);
    return this.readFilePhoto(tk, angle);
  }

  /** Reads a photo for internal staff, skipping the ownership check. */
  async readPhotoAwaitingInternal(id: string, angle: PreviewAngle): Promise<Buffer> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const tk = await this.model.findById(id).exec();
    if (!tk) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return this.readFilePhoto(tk, angle);
  }

  /** Loads several designs at once, used when building an order's production file. */
  findByIds(codes: string[]) {
    const valid = codes.filter((x) => Types.ObjectId.isValid(x)).map((x) => new Types.ObjectId(x));
    if (valid.length === 0) {
      return Promise.resolve([] as DesignDocument[]);
    }
    return this.model.find({ _id: { $in: valid } }).exec();
  }

  get angles(): PreviewAngle[] {
    return ANGLES_PREVIEW;
  }

  private async readFilePhoto(tk: DesignDocument, angle: PreviewAngle): Promise<Buffer> {
    const photo = tk.preview.find((a) => a.angle === angle);
    if (!photo) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return this.storage.read(StorageFolder.DESIGN, photo.fileName);
  }

  /** If a product type and size are given, they must exist and be on sale. */
  private async checkProduct(dto: SaveDesignDto): Promise<void> {
    // Ma de phai co trong danh muc va dang ban; ma rong nghia la chua chon de.
    await this.catalog.findDisplayBase(dto.stand?.baseCode);
    if (!dto.productTypeCode || !dto.sizeCode) {
      return;
    }
    await this.quote(dto.productTypeCode, dto.sizeCode);
  }

  private prepare(dto: SaveDesignDto) {
    return {
      name: dto.name,
      modelCode: dto.modelCode,
      paint: dto.paint ?? [],
      colorCodesUsed: dto.colorCodesUsed ?? [],
      productTypeCode: dto.productTypeCode ?? '',
      sizeCode: dto.sizeCode ?? '',
      engraving: {
        name: dto.engraving?.name ?? '',
        memorialDate: dto.engraving?.memorialDate ? new Date(dto.engraving.memorialDate) : null,
        message: dto.engraving?.message ?? '',
      },
      stand: {
        baseCode: dto.stand?.baseCode?.toUpperCase() ?? '',
        tone: dto.stand?.tone ?? StandTone.OAK,
        decorations: [...(dto.stand?.decorations ?? [])],
      },
      pet: dto.pet ? new Types.ObjectId(dto.pet) : null,
    };
  }
}
