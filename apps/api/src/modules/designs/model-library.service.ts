import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Mot mau nen trong thu vien mo hinh. */
export interface BaseModel {
  code: string;
  name: string;
  kind: string;
  pose: string;
  file: string;
  ready: boolean;
}

/**
 * Nhung noi co the tim thay ban khai mo hinh.
 *
 * May chu chay tu thu muc rieng cua no khi phat trien va tu thu muc goc khi
 * dong goi, nen duong dan duoc thu lan luot thay vi viet cung mot cho.
 */
const MAYBE = [
  '../web/public/models/manifest.json',
  '../../apps/web/public/models/manifest.json',
  'apps/web/public/models/manifest.json',
  'public/models/manifest.json',
];

/**
 * Doc thu vien mo hinh mau nen.
 *
 * Ban khai nam cung cho voi cac tep mo hinh de phia giao dien va phia may chu
 * nhin thay cung mot danh sach. May chu can danh sach nay de rang buoc phan
 * goi y: mot phuong an chi duoc tro toi mau nen co that trong thu vien, va chi
 * duoc to cac vung co ten da khai.
 *
 * Doc mot lan roi giu lai. Them mot tep mo hinh moi thi phai khoi dong lai may
 * chu, doi lay viec khong phai cham dia moi lan co nguoi xin goi y.
 */
@Injectable()
export class ModelLibraryService {
  private readonly logger = new Logger(ModelLibraryService.name);
  private readonly model: BaseModel[];
  private readonly zone: string[];
  /** Ma mau da bo, tro sang mau thay the. */
  private readonly retired: Record<string, string>;

  constructor() {
    const read = this.load();
    this.model = read.model;
    this.zone = read.zone;
    this.retired = read.retired;
    this.logger.log(`Thu vien mo hinh: ${this.model.length} mau nen, ${this.zone.length} vung`);
  }

  /** Cac mau nen dung duoc, da bo nhung tep chua san sang. */
  ready(): BaseModel[] {
    return this.model.filter((one) => one.ready);
  }

  /** Ten sau vung co ten tren mo hinh. */
  zoneName(): string[] {
    return [...this.zone];
  }

  /** Mot mau nen theo ma, hoac rong neu ma khong co trong thu vien. */
  byCode(code: string): BaseModel | null {
    const asked = code.trim().toUpperCase();
    // Ma da bo thi doi sang mau thay the, de phuong an cu van mo ra dung loai.
    const want = (this.retired[asked] ?? asked).toUpperCase();
    return this.ready().find((one) => one.code.toUpperCase() === want) ?? null;
  }

  /**
   * Mau nen hop nhat cho mot loai thu cung.
   *
   * Dung khi phuong an tro toi mot ma khong co that, de nguoi dung van co cai
   * de mo ra chinh tiep thay vi gap mot man hinh trong.
   */
  bestFor(kind: string): BaseModel | null {
    const all = this.ready();
    if (all.length === 0) {
      return null;
    }
    const want = kind.trim().toUpperCase();
    return all.find((one) => one.kind.toUpperCase() === want) ?? all[0];
  }

  /** Doc ban khai tu dia, hoac tra ve danh sach rong neu khong tim thay. */
  private load(): { model: BaseModel[]; zone: string[]; retired: Record<string, string> } {
    for (const where of MAYBE) {
      const path = resolve(join(process.cwd(), where));
      if (!existsSync(path)) {
        continue;
      }
      try {
        const raw = JSON.parse(readFileSync(path, 'utf8')) as {
          baseModel?: BaseModel[];
          zoneName?: string[];
          retired?: Record<string, string>;
        };
        return { model: raw.baseModel ?? [], zone: raw.zoneName ?? [], retired: raw.retired ?? {} };
      } catch (trouble) {
        const why = trouble instanceof Error ? trouble.message : String(trouble);
        this.logger.warn(`Ban khai mo hinh doc khong ra: ${why}`);
      }
    }
    this.logger.warn('Khong tim thay ban khai mo hinh. Phan goi y thiet ke se khong chay duoc.');
    return { model: [], zone: [], retired: {} };
  }
}
