import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import sharp from 'sharp';

/** Thu muc tam tren dich vu anh, anh chi nam day trong luc xu ly. */
const TEMP_FOLDER = 'petmory/restore-tmp';

/** Hieu ung AI cua dich vu anh cho tung thao tac, theo thu tu chay. */
const EFFECT_OF: Record<string, string> = {
  FACE_DETAIL: 'gen_restore',
  REMOVE_BACKGROUND: 'background_removal',
};
const EFFECT_ORDER = ['FACE_DETAIL', 'REMOVE_BACKGROUND'];

/** Ma tra ve khi dich vu dang xu ly bat dong bo, can hoi lai sau. */
const STILL_WORKING = 423;
const POLL_MS = 3000;

/** Hong lien tiep bay nhieu lan thi tam ngat, de khong treo moi luot phuc hoi. */
const BREAK_AFTER = 3;
const BREAK_MS = 60_000;

/** Ket qua sua anh: anh moi, rong khi khong lam duoc, kem ly do ngan. */
export interface ImageAiAnswer {
  data: Buffer | null;
  problem: string;
}

/**
 * Sua anh bang cac hieu ung AI cua dich vu anh Cloudinary (muc 4).
 *
 * Tach nen va phuc hoi chi tiet chay tren goi mien phi cua tai khoan dang dung
 * de luu anh, nen khong can them khoa nao. Anh duoc day len o che do rieng tu,
 * doc ket qua qua dia chi co chu ky, roi xoa ngay ca khi xu ly hong, de anh
 * cua khach khong nam lai tren dich vu.
 *
 * Moi lan goi ra ngoai deu co gioi han thoi gian va cau dao rieng. Khong lan
 * goi nao nem loi ra ngoai: hong thi tra ve anh rong kem ly do, va ben goi bao
 * cho khach biet thao tac do chua lam duoc.
 */
@Injectable()
export class CloudinaryImageAi {
  private readonly log = new Logger(CloudinaryImageAi.name);
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly timeoutMs: number;
  private failInRow = 0;
  private openUntil = 0;

  constructor(config: ConfigService) {
    this.cloudName = config.get<string>('storage.cloudinary.cloudName') ?? '';
    this.apiKey = config.get<string>('storage.cloudinary.apiKey') ?? '';
    this.apiSecret = config.get<string>('storage.cloudinary.apiSecret') ?? '';
    this.timeoutMs = config.get<number>('ai.timeoutMs') ?? 45000;
    if (this.ready) {
      // Cung tai khoan voi kho anh, dat lai cung gia tri nen khong anh huong kho anh.
      cloudinary.config({ cloud_name: this.cloudName, api_key: this.apiKey, api_secret: this.apiSecret, secure: true });
    }
  }

  /** Da co du thong tin tai khoan dich vu anh hay chua. */
  get ready(): boolean {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  }

  async edit(data: Buffer, operations: string[]): Promise<ImageAiAnswer> {
    if (!this.ready) {
      return { data: null, problem: 'Chua cau hinh dich vu anh' };
    }
    if (Date.now() < this.openUntil) {
      return { data: null, problem: 'Dich vu anh dang tam ngat' };
    }
    const effects = EFFECT_ORDER.filter((one) => operations.includes(one)).map((one) => EFFECT_OF[one]);
    if (effects.length === 0) {
      return { data, problem: '' };
    }
    let publicId = '';
    try {
      const uploaded = await this.upload(data);
      publicId = uploaded.public_id;
      let edited = await this.download(publicId, effects);
      // Tach nen cho ra nen trong suot; lot nen trang de anh dung duoc ngay nhu loi dan cu.
      if (operations.includes('REMOVE_BACKGROUND')) {
        edited = await sharp(edited).flatten({ background: '#ffffff' }).png().toBuffer();
      }
      this.failInRow = 0;
      return { data: edited, problem: '' };
    } catch (trouble) {
      this.failInRow += 1;
      if (this.failInRow >= BREAK_AFTER) {
        this.openUntil = Date.now() + BREAK_MS;
        this.failInRow = 0;
      }
      const why = trouble instanceof Error ? trouble.message.slice(0, 160) : 'Loi khong ro';
      this.log.warn(`Sua anh qua dich vu anh khong duoc: ${why}`);
      return { data: null, problem: why };
    } finally {
      if (publicId) {
        await this.remove(publicId);
      }
    }
  }

  private upload(data: Buffer): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: TEMP_FOLDER,
          public_id: randomUUID(),
          type: 'authenticated',
          resource_type: 'image',
          timeout: this.timeoutMs,
        },
        (trouble, result) => (trouble || !result ? reject(new Error(trouble?.message ?? 'Day anh len khong duoc')) : resolve(result)),
      );
      stream.end(data);
    });
  }

  /** Doc anh da qua hieu ung; dich vu co the bao dang xu ly, khi do hoi lai cho den het han. */
  private async download(publicId: string, effects: string[]): Promise<Buffer> {
    const url = cloudinary.url(publicId, {
      type: 'authenticated',
      sign_url: true,
      secure: true,
      format: 'png',
      transformation: effects.map((effect) => ({ effect })),
    });
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      const res = await fetch(url, { signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())) });
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
      if (res.status !== STILL_WORKING) {
        throw new Error(`Dich vu anh tra ve ${res.status} ${res.headers.get('x-cld-error') ?? ''}`.trim());
      }
      await new Promise((done) => setTimeout(done, POLL_MS));
    }
    throw new Error('Dich vu anh xu ly qua lau');
  }

  /** Xoa anh tam; xoa hong chi ghi nhat ky, khong lam hong luot phuc hoi. */
  private async remove(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        type: 'authenticated',
        invalidate: true,
      });
    } catch (trouble) {
      this.log.warn(`Khong xoa duoc anh tam tren dich vu anh: ${trouble instanceof Error ? trouble.message : 'loi khong ro'}`);
    }
  }
}
