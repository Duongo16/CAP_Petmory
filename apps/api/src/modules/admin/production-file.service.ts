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
    private readonly designs: DesignsService,
    private readonly catalog: CatalogService,
  ) {}

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
    const items: ProductionItem[] = madeRows.map((line) =>
      this.buildItem(line, byCode.get(line.designId?.toString() ?? ''), palette),
    );

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
      // Phieu kiem tra di kem ho so, de xuong tich ngay tren mot trang.
      qualityCheck: order.qualityCheck.map((one) => ({
        label: one.label,
        done: one.done,
        doneAt: one.doneAt,
      })),
      missing: this.listMissing(items),
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
