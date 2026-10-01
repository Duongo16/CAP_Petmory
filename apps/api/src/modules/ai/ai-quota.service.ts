import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiQuota, AiQuotaDocument, QuotaSpan } from './schemas/ai-quota.schema';
import { AiKind } from './schemas/ai-usage.schema';
import { BusinessConfigService } from '../business-config/business-config.service';

/** Han muc cua mot chuc nang, theo ba khoang. */
export interface PeriodQuota {
  day: number;
  month: number;
  year: number;
}

/** Mot lan dang ky da chiem cho o nhung khoang nao. */
export interface QuotaHold {
  owner: string;
  kind: AiKind;
  taken: { span: QuotaSpan; slot: string }[];
}

/** Ma loi khi hai yeu cau cung tao mot dong dem. */
const CLASH = 11000;

/** Loi bao cho nguoi dung khi het han muc. */
const OVER = 'Ban da dung het han muc cho chuc nang nay. Moi thu lai sau.';

/**
 * Giu han muc so luot dung tri tue nhan tao.
 *
 * Han muc do nhom Quan ly dat trong tham so nghiep vu, theo ngay, thang va
 * nam. Cho nao dat bang khong thi coi nhu khong gioi han.
 *
 * Cach dung: goi hold truoc khi lam viec, va goi release neu viec that bai.
 * Chiem cho truoc roi lam sau, chu khong lam truoc roi dem sau, vi dem sau
 * thi hai yeu cau song song deu lot qua.
 */
@Injectable()
export class AiQuotaService {
  private readonly logger = new Logger(AiQuotaService.name);

  constructor(
    @InjectModel(AiQuota.name) private readonly model: Model<AiQuotaDocument>,
    private readonly config: BusinessConfigService,
  ) {}

  /**
   * Chiem mot suat trong han muc, hoac bao het neu khong con.
   *
   * Tra ve thong tin da chiem o nhung khoang nao, de tra lai duoc khi viec
   * phia sau that bai.
   */
  async hold(owner: string, kind: AiKind): Promise<QuotaHold> {
    const setting = await this.config.get();
    const cap = setting.aiQuota?.[kind];
    const held: QuotaHold = { owner, kind, taken: [] };
    if (!cap) {
      return held;
    }

    for (const span of Object.values(QuotaSpan)) {
      const limit = Number(cap[span] ?? 0);
      if (!Number.isFinite(limit) || limit <= 0) {
        continue;
      }
      const slot = slotOf(span, new Date());
      const got = await this.takeOne(owner, kind, span, slot, limit);
      if (!got) {
        await this.release(held);
        throw new HttpException(OVER, HttpStatus.TOO_MANY_REQUESTS);
      }
      held.taken.push({ span, slot });
    }
    return held;
  }

  /**
   * Tra lai cac suat da chiem.
   *
   * Dung khi viec phia sau that bai, de mot lan hong khong an mat han muc cua
   * nguoi dung. Khong bao gio lam hong luong chinh: tra lai khong duoc thi chi
   * de lai mot dong canh bao.
   */
  async release(held: QuotaHold): Promise<void> {
    for (const one of held.taken) {
      try {
        await this.model
          .updateOne(
            {
              owner: new Types.ObjectId(held.owner),
              kind: held.kind,
              span: one.span,
              slot: one.slot,
              used: { $gt: 0 },
            },
            { $inc: { used: -1 } },
          )
          .exec();
      } catch (trouble) {
        const why = trouble instanceof Error ? trouble.message : String(trouble);
        this.logger.warn(`Khong tra lai duoc suat ${held.kind} ${one.span}: ${why}`);
      }
    }
    held.taken = [];
  }

  /** So luot da dung va con lai cua mot nguoi, de hien len man hinh. */
  async remaining(owner: string, kind: AiKind): Promise<PeriodQuota & { left: number }> {
    const setting = await this.config.get();
    const cap = setting.aiQuota?.[kind] ?? { day: 0, month: 0, year: 0 };
    const rows = await this.model
      .find({ owner: new Types.ObjectId(owner), kind })
      .select('span slot used')
      .exec();

    const now = new Date();
    let left = Number.MAX_SAFE_INTEGER;
    for (const span of Object.values(QuotaSpan)) {
      const limit = Number(cap[span] ?? 0);
      if (limit <= 0) {
        continue;
      }
      const slot = slotOf(span, now);
      const row = rows.find((one) => one.span === span && one.slot === slot);
      left = Math.min(left, Math.max(0, limit - (row?.used ?? 0)));
    }

    return {
      day: Number(cap.day ?? 0),
      month: Number(cap.month ?? 0),
      year: Number(cap.year ?? 0),
      left: left === Number.MAX_SAFE_INTEGER ? -1 : left,
    };
  }

  /**
   * Cong them mot suat neu con cho, trong dung mot buoc.
   *
   * Dieu kien con cho nam ngay trong cau lenh cap nhat, nen khong co khe nao
   * giua luc kiem va luc cong de mot yeu cau khac chen vao. Khi dong dem da
   * day, cau lenh khong khop dong nao va buoc tao moi bi rang buoc duy nhat
   * chan lai, nen ket qua van la khong cho qua.
   */
  private async takeOne(
    owner: string,
    kind: AiKind,
    span: QuotaSpan,
    slot: string,
    limit: number,
  ): Promise<boolean> {
    try {
      const done = await this.model
        .findOneAndUpdate(
          { owner: new Types.ObjectId(owner), kind, span, slot, used: { $lt: limit } },
          { $inc: { used: 1 } },
          { new: true, upsert: true },
        )
        .exec();
      return done !== null;
    } catch (trouble) {
      if (isClash(trouble)) {
        return false;
      }
      throw trouble;
    }
  }
}

/**
 * Ten khoang chua thoi diem da cho, tinh theo gio quoc te.
 *
 * Moc thoi gian trong he thong deu luu theo gio quoc te, nen han muc cung
 * phai cat theo cung mot moc, neu khong thi mot nguoi o mui gio khac se thay
 * han muc dat lai vao mot luc la.
 */
function slotOf(span: QuotaSpan, when: Date): string {
  const whole = when.toISOString();
  if (span === QuotaSpan.DAY) {
    return whole.slice(0, 10);
  }
  return span === QuotaSpan.MONTH ? whole.slice(0, 7) : whole.slice(0, 4);
}

/** Loi do hai yeu cau cung tao mot dong dem, nghia la dong do da day. */
function isClash(trouble: unknown): boolean {
  return (
    typeof trouble === 'object' &&
    trouble !== null &&
    'code' in trouble &&
    (trouble as { code: unknown }).code === CLASH
  );
}
