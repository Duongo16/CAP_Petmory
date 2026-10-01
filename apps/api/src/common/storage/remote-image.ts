import { BadRequestException, Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Kieu anh nhan duoc, giong het bo loc cua duong tai tep len. */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Duoi tep theo tung kieu anh, de ten tep dat ra van dung duoi. */
const EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** Tran kich thuoc mot anh tai ve, tinh bang byte. */
const MAX_BYTES = 10 * 1024 * 1024;

/** Cho toi da bao lau moi bo cuoc. */
const TIMEOUT_MS = 10_000;

/** Di theo toi da bao nhieu lan chuyen huong. */
const MAX_HOPS = 3;

/**
 * Cac dai dia chi trong noi bo mang. Mot dia chi roi vao day thi tu choi, vi
 * nguoi ngoai co the muon may chu tu di doc trang quan tri hay kho thong tin
 * cua chinh no. Bo loc nay chan huong tan cong do.
 */
function insideNetwork(address: string): boolean {
  const kind = isIP(address);
  if (kind === 6) {
    const plain = address.toLowerCase();
    if (plain === '::1' || plain === '::') {
      return true;
    }
    if (plain.startsWith('fc') || plain.startsWith('fd') || plain.startsWith('fe80')) {
      return true;
    }
    return plain.startsWith('::ffff:') ? insideNetwork(plain.slice(7)) : false;
  }
  if (kind !== 4) {
    return true;
  }
  const part = address.split('.').map(Number);
  if (part[0] === 10 || part[0] === 127 || part[0] === 0) {
    return true;
  }
  if (part[0] === 192 && part[1] === 168) {
    return true;
  }
  if (part[0] === 172 && part[1] >= 16 && part[1] <= 31) {
    return true;
  }
  if (part[0] === 169 && part[1] === 254) {
    return true;
  }
  return part[0] >= 224;
}

/**
 * Tai mot buc anh tu duong dan tren mang ve thanh mot tep trong bo nho.
 *
 * Ket qua mang dung hinh dang ma cac duong tai tep len dang nhan, nen cac lop
 * ben duoi khong can biet buc anh den tu may cua khach hay tu mot trang khac.
 */
@Injectable()
export class RemoteImageService {
  async fetch(link: string): Promise<Express.Multer.File> {
    let where = await this.check(link);
    let answer: Response | null = null;

    for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
      answer = await this.ask(where);
      const moved = answer.headers.get('location');
      if (answer.status < 300 || answer.status > 399 || !moved) {
        break;
      }
      where = await this.check(new URL(moved, where).toString());
      answer = null;
    }

    if (!answer || !answer.ok) {
      throw new BadRequestException('IMAGE_LINK_UNREACHABLE');
    }

    const kind = (answer.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.includes(kind)) {
      throw new BadRequestException('IMAGE_LINK_NOT_IMAGE');
    }

    const told = Number(answer.headers.get('content-length') ?? 0);
    if (told > MAX_BYTES) {
      throw new BadRequestException('IMAGE_LINK_TOO_BIG');
    }

    const body = Buffer.from(await answer.arrayBuffer());
    if (body.length === 0) {
      throw new BadRequestException('IMAGE_LINK_UNREACHABLE');
    }
    if (body.length > MAX_BYTES) {
      throw new BadRequestException('IMAGE_LINK_TOO_BIG');
    }

    return {
      fieldname: 'file',
      originalname: this.nameFrom(where, kind),
      encoding: '7bit',
      mimetype: kind,
      size: body.length,
      buffer: body,
      stream: undefined as never,
      destination: '',
      filename: '',
      path: '',
    };
  }

  /** Kiem tra duong dan va tra ve dang da chuan hoa. */
  private async check(link: string): Promise<string> {
    let parsed: URL;
    try {
      parsed = new URL(link.trim());
    } catch {
      throw new BadRequestException('IMAGE_LINK_BAD');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('IMAGE_LINK_BAD');
    }

    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) !== 0) {
      if (insideNetwork(host)) {
        throw new BadRequestException('IMAGE_LINK_BLOCKED');
      }
      return parsed.toString();
    }

    let found: { address: string }[];
    try {
      found = await lookup(host, { all: true });
    } catch {
      throw new BadRequestException('IMAGE_LINK_UNREACHABLE');
    }
    if (found.length === 0 || found.some((one) => insideNetwork(one.address))) {
      throw new BadRequestException('IMAGE_LINK_BLOCKED');
    }
    return parsed.toString();
  }

  private async ask(where: string): Promise<Response> {
    try {
      return await globalThis.fetch(where, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: ALLOWED_TYPES.join(',') },
      });
    } catch {
      throw new BadRequestException('IMAGE_LINK_UNREACHABLE');
    }
  }

  /** Dat ten tep tu duong dan, khong lay duoc thi dat ten chung. */
  private nameFrom(where: string, kind: string): string {
    const tail = new URL(where).pathname.split('/').pop() ?? '';
    const clean = tail.replace(/[^\w.-]/g, '').slice(-80);
    return clean.includes('.') ? clean : `anh-tu-lien-ket.${EXTENSION[kind]}`;
  }
}
