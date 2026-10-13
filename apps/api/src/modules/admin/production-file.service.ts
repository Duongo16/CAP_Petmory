import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { DesignsService } from '../designs/designs.service';
import { CatalogService } from '../catalog/catalog.service';
import { PetPhoto, PetPhotoDocument } from '../photos/schemas/pet-photo.schema';
import { DesignDocument } from '../designs/schemas/design.schema';
import { LineKind } from '../cart/schemas/cart.schema';
import { MSG } from '../../common/constants/messages';
import { Pet, PetDocument } from '../pets/schemas/pet.schema';
import { ModelLibraryService } from '../designs/model-library.service';
import { BusinessConfigService } from '../business-config/business-config.service';
import { StorageFolder, StorageService } from '../../common/storage/storage.service';

/** One wool colour needed, with a readable name rather than just a code. */
export interface WoolRoll {
  code: string;
  displayName: string;
  swatch: string;
}

/** Ma de 'khong de' trong danh muc: co ma nhung khong co gi de xuong lam. */
const BASE_NONE = 'BASE-NONE';

/** One product to make, carrying everything the workshop needs to know. */
export interface ProductionItem {
  displayName: string;
  quantity: number;
  petName: string;
  modelCode: string | null;
  nameDesign: string | null;
  designId: string | null;
  woolRolls: WoolRoll[];
  /** Ma mau theo tung vung co ten, de xuong pha len dung cho. */
  zoneColours: { zone: string; wool: WoolRoll }[];
  engraving: { name: string; memorialDate: Date | null; message: string } | null;
  /** De trung bay: ten de theo don, mau go va do trang tri. Rong khi khong co de. */
  stand: { baseName: string; tone: string; decorations: string[] } | null;
  /** Phu kien gan len mau. */
  accessories: { code: string; displayName: string }[];
  /** Hop va khung khach chon, xuong dong goi kem. */
  packaging: { code: string; kind: string; displayName: string }[];
  featureNote?: string;
  /** Dac diem AI doc tu anh cua be, chi de tham khao. */
  aiNote?: string;
  /** Vi tri dong trong don. */
  rowIndex?: number;
  pet?: { name: string; breed: string; kind: string; trait: string[] } | null;
  sizeSpec?: { displayName: string; dimensions: string; explainer: string; productionDays: number } | null;
  model?: { code: string; file: string; fileFull: string } | null;
  paint?: { mesh: string; color: string }[];
  anglesPreview: string[];
  productionDays: number;
}

/** One photo the customer sent, with its quality score. */
export interface ReferencedPhoto {
  code: string;
  angle: string;
  isRestored: boolean;
  confirmedByOwner: boolean;
  labelQuality: string;
}

/**
 * Everything the workshop needs to start on an order.
 *
 * All of it is read from the order's frozen data; prices and durations are never
 * recomputed, so this file does not change when the catalog is edited later.
 */
@Injectable()
export class ProductionFileService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(PetPhoto.name) private readonly photoModel: Model<PetPhotoDocument>,
    @InjectModel(Pet.name) private readonly petModel: Model<PetDocument>,
    private readonly designs: DesignsService,
    private readonly catalog: CatalogService,
    private readonly library: ModelLibraryService,
    private readonly storage: StorageService,
    private readonly config: BusinessConfigService,
  ) {}

  /**
   * Doc anh xem truoc cua mot dong don tu ban chup luc dat (muc 7, 11).
   *
   * Khach sua ban thiet ke sau khi dat thi anh moi khong duoc lan vao ho so;
   * xuong luon thay dung anh cua thu khach da dong y. Don cu chua co ban chup
   * thi moi doc tu ban thiet ke goc.
   */
  async readRowPreview(orderCode: string, rowIndex: number, angle: string): Promise<Buffer> {
    const order = await this.orderModel.findOne({ orderCode: orderCode.toUpperCase() }).exec();
    const row = order?.rows[rowIndex];
    if (!row) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const taken = row.design?.preview.find((one) => one.angle === angle);
    if (taken) {
      return this.storage.read(StorageFolder.DESIGN, taken.fileName);
    }
    if (row.design || !row.designId) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return this.designs.readPhotoAwaitingInternal(row.designId.toString(), angle as never);
  }

  /**
   * Doc mot anh tham chieu cho xuong.
   *
   * Chi tra anh nam trong danh sach anh cua chinh don nay, de duong nay khong
   * thanh loi doc anh bat ky cua khach nao chi bang ma anh.
   */
  async readOrderPhoto(orderCode: string, photoId: string): Promise<{ data: Buffer; fileType: string }> {
    const order = await this.orderModel.findOne({ orderCode: orderCode.toUpperCase() }).exec();
    if (!order) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const olderIds = order.rows.filter((line) => !line.design && line.designId).map((line) => line.designId!.toString());
    const allowed = await this.petPhotoOfOrder(order, await this.designs.findByIds(olderIds));
    if (!allowed.some((one) => one.code === photoId)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const photo = await this.photoModel.findById(photoId).exec();
    if (!photo) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return { data: await this.storage.read(StorageFolder.PET, photo.fileName), fileType: photo.fileType };
  }

  async buildProfile(orderCode: string) {
    const order = await this.orderModel.findOne({ orderCode: orderCode.toUpperCase() }).exec();
    if (!order) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }

    /*
     * Ban ve duoc doc tu ban chup nam trong chinh don hang, khong doc tu ban
     * thiet ke goc. Khach co the da sua hoac xoa ban goc sau khi dat; thu
     * xuong phai lam la thu khach da dong y luc tra tien.
     *
     * Nhung don dat truoc khi co ban chup thi khong co gi de doc, nen van tra
     * ve ban goc cho chung. Cac don moi deu di duong ban chup.
     */
    const olderRows = order.rows.filter((line) => !line.design && line.designId);
    const designs = await this.designs.findByIds(
      olderRows.map((line) => line.designId!.toString()),
    );
    const byCode = new Map(designs.map((design) => [design._id.toString(), design]));
    const palette = await this.tableReturnColor();

    /*
     * Ho so san xuat chi liet ke dong hang tuy bien.
     *
     * Hang co san khong qua xuong: no di thang tu kho sang khau dong goi, nen
     * dua no vao day chi lam nguoi tho phai doc qua nhung dong khong lien
     * quan den viec cua minh.
     */
    const madeRows = order.rows.filter((line) => line.kind !== LineKind.READY_MADE);
    const items: ProductionItem[] = [];
    for (const line of madeRows) {
      const item = this.buildItem(line, byCode.get(line.designId?.toString() ?? ''), palette);
      // Vi tri dong trong don, de doc anh xem truoc tu chinh ban chup cua dong nay.
      const rowIndex = order.rows.indexOf(line);
      items.push({ ...item, rowIndex, ...(await this.extraOf(line, byCode.get(line.designId?.toString() ?? ''))) });
    }

    /** Cac dong hang co san cua don, chi de khau dong goi biet phai lay gi. */
    const packRows = order.rows
      .filter((line) => line.kind === LineKind.READY_MADE)
      .map((line) => ({
        goodsCode: line.goodsCode,
        sku: line.sku,
        displayName: line.displayName,
        quantity: line.quantity,
      }));

    return {
      orderCode: order.orderCode,
      status: order.status,
      orderedAt: (order as unknown as { createdAt: Date }).createdAt,
      estimatedDelivery: order.estimatedDelivery,
      productionDays: order.productionDays,
      delivery: order.delivery,
      items,
      packRows,
      petPhoto: await this.petPhotoOfOrder(order, designs),
      // Phieu kiem tra di kem ho so, de xuong tich ngay tren mot trang. Don chua vao
      // san xuat thi chua co phieu rieng, nen in mau phieu theo cau hinh hien tai.
      ...(await this.qualityOf(order)),
      missing: this.listMissing(items),
    };
  }

  /**
   * Phan bo sung cua ho so theo muc 11: bang thong so kich co, tep mo hinh de
   * do kich thuoc, mau da to de dung lai mo hinh, dac diem rieng cua be.
   */
  private async extraOf(line: OrderDocument['rows'][number], older: DesignDocument | undefined) {
    const taken = line.design;
    const modelCode = taken?.modelCode ?? older?.modelCode ?? '';
    const model = modelCode ? this.library.byCode(modelCode) : null;
    let sizeSpec: { displayName: string; dimensions: string; explainer: string; productionDays: number } | null = null;
    try {
      const kind = line.productTypeCode ? await this.catalog.detailProductType(line.productTypeCode) : null;
      const size = kind?.sizes.find((one) => one.code === line.sizeCode);
      sizeSpec = size
        ? { displayName: size.displayName, dimensions: size.dimensions, explainer: size.explainer, productionDays: size.productionDays }
        : null;
    } catch (trouble) {
      // Loai san pham da bi doi ma thi khong con bang thong so; loi khac van bao len.
      if (!(trouble instanceof NotFoundException)) {
        throw trouble;
      }
      sizeSpec = null;
    }
    const petId = taken?.pet ?? older?.pet ?? null;
    const pet = petId ? await this.petModel.findById(petId).select('name breed trait kind').exec() : null;
    return {
      featureNote: taken?.featureNote ?? older?.featureNote ?? '',
      aiNote: taken?.aiNote ?? older?.aiNote ?? '',
      pet: pet ? { name: pet.name, breed: pet.breed, kind: pet.kind, trait: [...(pet.trait ?? [])] } : null,
      sizeSpec,
      model: model ? { code: model.code, file: model.file, fileFull: model.fileFull ?? model.file } : null,
      paint: (taken?.paint ?? older?.paint ?? []).map((one) => ({ mesh: one.mesh, color: one.color })),
    };
  }

  private async qualityOf(order: OrderDocument) {
    if (order.qualityCheck.length > 0) {
      return {
        qualityCheck: order.qualityCheck.map((one) => ({ label: one.label, done: one.done, doneAt: one.doneAt })),
        qualityDraft: false,
      };
    }
    const setting = await this.config.get();
    return {
      qualityCheck: (setting.qcChecklist ?? []).map((label) => ({ label, done: false, doneAt: null })),
      qualityDraft: true,
    };
  }

  /** Maps a colour code to its name and swatch, so the workshop reads words, not codes. */
  private async tableReturnColor(): Promise<Map<string, WoolRoll>> {
    const list = await this.catalog.listColor(false);
    return new Map(
      list.map((m) => [m.code, { code: m.code, displayName: m.displayName, swatch: m.swatch }]),
    );
  }

  private buildItem(
    line: OrderDocument['rows'][number],
    older: DesignDocument | undefined,
    palette: Map<string, WoolRoll>,
  ): ProductionItem {
    // Ban chup trong don la nguon chinh; ban goc chi dung cho don cu chua co.
    const taken = line.design;
    const modelCode = taken?.modelCode ?? older?.modelCode ?? null;
    const colours = taken?.colorCodesUsed ?? older?.colorCodesUsed ?? [];
    const engraving = taken?.engraving ?? older?.engraving ?? null;
    const preview = taken?.preview ?? older?.preview ?? [];
    const zones = taken?.zonePaint ?? older?.zonePaint ?? [];
    const stand = taken?.stand ?? older?.stand ?? null;

    return {
      displayName: line.displayName,
      quantity: line.quantity,
      petName: line.petName,
      productionDays: line.productionDays,
      designId: line.designId?.toString() ?? null,
      nameDesign: older?.name ?? null,
      modelCode,
      woolRolls: colours.map(
        (code) => palette.get(code) ?? { code, displayName: code, swatch: '' },
      ),
      /*
       * Ma mau theo tung vung co ten, dung nhu muc 11 va muc 6 yeu cau.
       *
       * Rong khi ban thiet ke duoc lam tren mot mo hinh chua tach du vung.
       * Luc do xuong van co bang ma mau chung o tren de pha len, nhung khong
       * biet mau nao thuoc vung nao, va do la gioi han cua tep mo hinh chu
       * khong phai cua ho so.
       */
      zoneColours: zones.map((one) => ({
        zone: one.zone,
        wool: palette.get(one.colorCode) ?? {
          code: one.colorCode,
          displayName: one.colorCode,
          swatch: '',
        },
      })),
      engraving: engraving
        ? {
            name: engraving.name ?? '',
            memorialDate: engraving.memorialDate ?? null,
            message: engraving.message ?? '',
          }
        : null,
      stand: line.displayBaseCode && line.displayBaseCode !== BASE_NONE
        ? {
            baseName: line.displayBaseName,
            tone: stand?.tone ?? '',
            decorations: [...(stand?.decorations ?? [])],
          }
        : null,
      // Phu kien chot cung dong luc dat, dung nhu khach da tra tien (muc 11).
      accessories: (line.accessories ?? []).map((one) => ({ code: one.code, displayName: one.displayName })),
      packaging: (line.packaging ?? []).map((one) => ({ code: one.code, kind: one.kind, displayName: one.displayName })),
      anglesPreview: preview.map((a) => a.angle),
    };
  }

  /** Photos the customer sent for the pets attached to this order. */
  private async petPhotoOfOrder(
    order: OrderDocument,
    designs: DesignDocument[],
  ): Promise<ReferencedPhoto[]> {
    /*
     * Anh cung lay tu ban chup: day la dung nhung tam khach da gui vao luc
     * dat hang. Khach xoa anh khoi album sau do cung khong lam mat anh o day.
     */
    const fromSnapshot = order.rows
      .flatMap((line) => line.design?.petPhoto ?? [])
      .map((one) => one.toString());

    if (fromSnapshot.length > 0) {
      const kept = await this.photoModel
        .find({ _id: { $in: fromSnapshot } })
        .sort({ createdAt: 1 })
        .exec();
      return kept.map((a) => ({
        code: a._id.toString(),
        angle: a.angle,
        isRestored: a.isRestored,
        confirmedByOwner: a.confirmedByOwner,
        labelQuality: a.quality.label,
      }));
    }

    const codesPet = designs
      .map((design) => design.pet)
      .filter((x): x is Types.ObjectId => Boolean(x));
    if (codesPet.length === 0) {
      return [];
    }
    const list = await this.photoModel
      .find({ pet: { $in: codesPet }, isHidden: false })
      .sort({ createdAt: 1 })
      .exec();
    return list.map((a) => ({
      code: a._id.toString(),
      angle: a.angle,
      isRestored: a.isRestored,
      confirmedByOwner: a.confirmedByOwner,
      labelQuality: a.quality.label,
    }));
  }

  /**
   * Anything missing is stated at the top of the file, so the coordinator knows
   * to check with the customer before handing the job to the workshop.
   */
  private listMissing(items: ProductionItem[]): string[] {
    const missing: string[] = [];
    if (items.some((m) => !m.designId)) {
      missing.push('NO_DESIGN');
    }
    if (items.some((m) => m.designId && m.woolRolls.length === 0)) {
      missing.push('NO_COLOR_CODES');
    }
    if (items.some((m) => m.designId && m.anglesPreview.length < 6)) {
      missing.push('NO_PREVIEWS');
    }
    return missing;
  }
}
