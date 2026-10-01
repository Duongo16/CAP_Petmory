import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiKind, AiMode, AiUsage, AiUsageDocument } from './schemas/ai-usage.schema';
import { BusinessConfigService } from '../business-config/business-config.service';

/** Mot khoang thoi gian de dem so luot da dung. */
export interface UsageWindow {
  from: Date;
  to: Date;
}

/** So luot va so tien cua mot loai luot dung. */
export interface UsageTotal {
  kind: string;
  count: number;
  /** Tong tien, so nguyen dong, viet duoi dang chuoi. */
  cost: string;
}

/**
 * So ghi cac luot dung tri tue nhan tao.
 *
 * Moi luot tu nho don gia cua chinh no. Muc 22 khoan 6 ghi ro doi don gia
 * khong duoc lam doi so lieu ky da qua, ma dieu do chi dung neu bao cao cong
 * lai tu gia da ghi chu khong hoi lai tham so nghiep vu hien tai.
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    @InjectModel(AiUsage.name) private readonly model: Model<AiUsageDocument>,
    private readonly config: BusinessConfigService,
  ) {}

  /**
   * Ghi mot luot dung, kem don gia doc tu tham so nghiep vu ngay luc nay.
   *
   * Khong bao gio lam hong viec chinh: mot luot khong ghi duoc chi de lai mot
   * dong canh bao trong nhat ky may chu, chu khach van nhan duoc ket qua ho
   * vua yeu cau.
   */
  async record(
    kind: AiKind,
    owner: string,
    mode: AiMode,
    resourceId = '',
    problem = '',
  ): Promise<void> {
    try {
      const setting = await this.config.get();
      const price = setting.aiUnitPrice[kind] ?? Types.Decimal128.fromString('0');
      await this.model.create({
        owner: new Types.ObjectId(owner),
        kind,
        unitPrice: price,
        mode,
        resourceId,
        problem,
      });
    } catch (trouble) {
      const why = trouble instanceof Error ? trouble.message : String(trouble);
      this.logger.warn(`Khong ghi duoc luot dung ${kind}: ${why}`);
    }
  }

  /**
   * Tong so luot va tong tien cua tung loai, trong mot khoang thoi gian.
   *
   * Tien duoc cong bang so nguyen, khong qua so thuc o bat ky buoc nao, dung
   * theo muc 22 khoan 4.
   */
  async totals(window: UsageWindow): Promise<UsageTotal[]> {
    const rows = await this.model
      .find({ createdAt: { $gte: window.from, $lte: window.to } })
      .select('kind unitPrice')
      .exec();

    const countOf = new Map<string, number>();
    const costOf = new Map<string, bigint>();
    for (const one of rows) {
      const kind = one.kind;
      countOf.set(kind, (countOf.get(kind) ?? 0) + 1);
      costOf.set(kind, (costOf.get(kind) ?? 0n) + asWholeDong(one.unitPrice.toString()));
    }

    return Object.values(AiKind).map((kind) => ({
      kind,
      count: countOf.get(kind) ?? 0,
      cost: (costOf.get(kind) ?? 0n).toString(),
    }));
  }

  /** So luot cua mot nguoi trong mot khoang, dung de kiem han muc. */
  countFor(owner: string, kind: AiKind, since: Date): Promise<number> {
    return this.model
      .countDocuments({ owner: new Types.ObjectId(owner), kind, createdAt: { $gte: since } })
      .exec();
  }
}

/**
 * Phan nguyen cua mot so tien.
 *
 * He thong chi tinh bang dong chan. Cat phan le o day thay vi lam tron, vi
 * lam tron se tao ra tien khong co that trong bao cao.
 */
function asWholeDong(raw: string): bigint {
  return BigInt(raw.split('.')[0] || '0');
}
