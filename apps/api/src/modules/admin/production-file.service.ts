import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { DesignsService } from '../designs/designs.service';
import { CatalogService } from '../catalog/catalog.service';
import { PetPhoto, PetPhotoDocument } from '../photos/schemas/pet-photo.schema';
import { DesignDocument } from '../designs/schemas/design.schema';
import { MSG } from '../../common/constants/messages';

/** One wool colour needed, with a readable name rather than just a code. */
export interface WoolRoll {
  code: string;
  displayName: string;
  swatch: string;
}

/** One product to make, carrying everything the workshop needs to know. */
export interface ProductionItem {
  displayName: string;
  quantity: number;
  petName: string;
  modelCode: string | null;
  nameDesign: string | null;
  designId: string | null;
  woolRolls: WoolRoll[];
  engraving: { name: string; memorialDate: Date | null; message: string } | null;
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

    const codesDesign = order.rows
      .map((d) => d.designId?.toString())
      .filter((x): x is string => Boolean(x));
    const designs = await this.designs.findByIds(codesDesign);
    const byCode = new Map(designs.map((design) => [design._id.toString(), design]));
    const palette = await this.tableReturnColor();

    const items: ProductionItem[] = order.rows.map((line) =>
      this.buildItem(line, byCode.get(line.designId?.toString() ?? ''), palette),
    );

    return {
      orderCode: order.orderCode,
      status: order.status,
      orderedAt: (order as unknown as { createdAt: Date }).createdAt,
      estimatedDelivery: order.estimatedDelivery,
      productionDays: order.productionDays,
      delivery: order.delivery,
      items,
      petPhoto: await this.petPhotoOfOrder(order, designs),
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
    design: DesignDocument | undefined,
    palette: Map<string, WoolRoll>,
  ): ProductionItem {
    return {
      displayName: line.displayName,
      quantity: line.quantity,
      petName: line.petName,
      productionDays: line.productionDays,
      designId: design?._id.toString() ?? null,
      nameDesign: design?.name ?? null,
      modelCode: design?.modelCode ?? null,
      woolRolls: (design?.colorCodesUsed ?? []).map(
        (code) => palette.get(code) ?? { code, displayName: code, swatch: '' },
      ),
      engraving: design
        ? {
            name: design.engraving?.name ?? '',
            memorialDate: design.engraving?.memorialDate ?? null,
            message: design.engraving?.message ?? '',
          }
        : null,
      anglesPreview: (design?.preview ?? []).map((a) => a.angle),
    };
  }

  /** Photos the customer sent for the pets attached to this order. */
  private async petPhotoOfOrder(
    order: OrderDocument,
    designs: DesignDocument[],
  ): Promise<ReferencedPhoto[]> {
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
