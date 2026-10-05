import sharp from 'sharp';
import { BaseModel } from './model-library.service';

/** Mot ma mau len trong bang mau, kem o mau de so khoang cach. */
export interface PaletteColour {
  code: string;
  swatch: string;
}

/** Loai va tu the nhan ra tu anh, cung mau tung vung dang ma mau sau so. */
export interface PhotoReading {
  kind: string;
  pose: string;
  breed: string;
  colours: Partial<Record<string, string>>;
}

/** Mau nen chon cho ban dung san, va co phai dung mau mac dinh vi chua co mau cho loai do. */
export interface ModelPick {
  model: BaseModel;
  fallback: boolean;
}

/** Ma mau nen mac dinh khi chua co mau nao hop voi loai cua be. */
export const DEFAULT_MODEL = 'BASE-DOG-SIT';

/** Hai vung mat va mui dung bang mau rieng, cac vung con lai dung mau long. */
const FACE_ZONES = new Set(['EYE', 'NOSE']);

/** Mau mac dinh cho mat va mui khi anh khong cho biet, deu la mau toi. */
const FACE_DEFAULT: Record<string, string> = { EYE: '#3f2716', NOSE: '#1f1a17' };

/** Vung nao doc khong ra thi muon mau cua vung nay. */
const BORROW: Record<string, string> = { BELLY_FUR: 'MAIN_FUR', EAR: 'MAIN_FUR', TAIL: 'MAIN_FUR' };

const HEX = /^#?([0-9a-f]{6})$/i;

/** Doi ma mau sau so sang ba so do, sai khuon thi tra ve rong. */
function rgbOf(hex: string): [number, number, number] | null {
  const hit = HEX.exec(hex.trim());
  if (!hit) {
    return null;
  }
  const n = Number.parseInt(hit[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Doi sang khong gian mau Lab, noi khoang cach gan voi mat nguoi nhin. */
function labOf([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Ma mau len gan nhat voi mot mau, chi trong bang mau dua vao. */
export function nearestCode(hex: string, palette: PaletteColour[]): string | null {
  const rgb = rgbOf(hex);
  if (!rgb || palette.length === 0) {
    return null;
  }
  const want = labOf(rgb);
  let best: string | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const one of palette) {
    const there = rgbOf(one.swatch);
    if (!there) {
      continue;
    }
    const gap = distance(want, labOf(there));
    if (gap < bestGap) {
      bestGap = gap;
      best = one.code;
    }
  }
  return best;
}

/**
 * Chon mau nen theo loai va tu the.
 *
 * Chi chon trong cac mau nen du sau vung. Dung loai thi uu tien dung tu the,
 * khong co tu the do thi lay mau dau cua loai. Chua co mau nao cho loai cua be
 * thi dung mau mac dinh va bao la mau thay the.
 */
export function pickModel(models: BaseModel[], kind: string, pose: string): ModelPick | null {
  const pool = models.filter((one) => one.core);
  const usable = pool.length > 0 ? pool : models;
  if (usable.length === 0) {
    return null;
  }
  const sameKind = usable.filter((one) => one.kind.toUpperCase() === kind.toUpperCase());
  if (sameKind.length > 0) {
    const samePose = sameKind.find((one) => one.pose.toUpperCase() === pose.toUpperCase());
    return { model: samePose ?? sameKind[0], fallback: false };
  }
  const standby = usable.find((one) => one.code === DEFAULT_MODEL) ?? usable[0];
  return { model: standby, fallback: true };
}

/**
 * Doi mau tung vung sang ma mau len.
 *
 * Vung long chon trong mau long, mat va mui chon trong bang mau mat mui. Vung
 * doc khong ra thi muon mau cua than, mat va mui khong co thi dung mau toi.
 */
export function zonePaintOf(
  zones: string[],
  colours: Partial<Record<string, string>>,
  fur: PaletteColour[],
  face: PaletteColour[],
): { zone: string; colorCode: string }[] {
  const out: { zone: string; colorCode: string }[] = [];
  for (const zone of zones) {
    const own = colours[zone];
    const borrowed = BORROW[zone] ? colours[BORROW[zone]] : undefined;
    const hex = own && rgbOf(own) ? own : borrowed && rgbOf(borrowed) ? borrowed : FACE_DEFAULT[zone];
    if (!hex) {
      continue;
    }
    const code = nearestCode(hex, FACE_ZONES.has(zone) ? face : fur);
    if (code) {
      out.push({ zone, colorCode: code });
    }
  }
  return out;
}

/** Doi mot mau ba so do sang ma sau so. */
function hexOf(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Doc mau long tu anh ma khong can dich vu ngoai.
 *
 * Thu nho anh, lay mau nen tu vien anh, bo nhung diem gan mau nen, roi gom cac
 * diem con lai thanh tung nhom mau. Nhom lon nhat la mau than, nhom lon thu
 * hai du khac han la mau bung. Day chi la cach do du phong, kem hon dich vu AI.
 */
export async function readColoursLocally(photo: Buffer): Promise<Partial<Record<string, string>>> {
  const side = 48;
  const { data } = await sharp(photo).rotate().resize(side, side, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => {
    const i = (y * side + x) * 3;
    return [data[i], data[i + 1], data[i + 2]] as [number, number, number];
  };

  const edge: [number, number, number][] = [];
  for (let i = 0; i < side; i += 1) {
    edge.push(at(i, 0), at(i, side - 1), at(0, i), at(side - 1, i));
  }
  const back = labOf(edge.reduce((sum, one) => [sum[0] + one[0], sum[1] + one[1], sum[2] + one[2]], [0, 0, 0]).map((v) => v / edge.length) as [number, number, number]);

  const buckets = new Map<string, { n: number; sum: [number, number, number] }>();
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const rgb = at(x, y);
      if (distance(labOf(rgb), back) < 18) {
        continue;
      }
      const key = rgb.map((v) => v >> 5).join(',');
      const hold = buckets.get(key) ?? { n: 0, sum: [0, 0, 0] };
      hold.n += 1;
      hold.sum = [hold.sum[0] + rgb[0], hold.sum[1] + rgb[1], hold.sum[2] + rgb[2]];
      buckets.set(key, hold);
    }
  }
  const groups = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((one) => [one.sum[0] / one.n, one.sum[1] / one.n, one.sum[2] / one.n] as [number, number, number]);
  if (groups.length === 0) {
    return {};
  }
  const main = groups[0];
  const second = groups.find((one) => distance(labOf(one), labOf(main)) > 25);
  return {
    MAIN_FUR: hexOf(...main),
    ...(second ? { BELLY_FUR: hexOf(...second) } : {}),
  };
}

/** Lam sach cau tra loi cua dich vu: chi giu loai, tu the va ma mau dung khuon. */
export function cleanReading(raw: unknown, zones: string[]): PhotoReading | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const one = raw as { kind?: unknown; pose?: unknown; breed?: unknown; colors?: unknown; colours?: unknown };
  const kind = String(one.kind ?? '').toUpperCase();
  const pose = String(one.pose ?? '').toUpperCase();
  const given = (one.colors ?? one.colours ?? {}) as Record<string, unknown>;
  const colours: Partial<Record<string, string>> = {};
  for (const zone of zones) {
    const value = String(given[zone] ?? '').trim();
    if (rgbOf(value)) {
      colours[zone] = value.startsWith('#') ? value : `#${value}`;
    }
  }
  if (!['DOG', 'CAT', 'BIRD', 'OTHER'].includes(kind) && Object.keys(colours).length === 0) {
    return null;
  }
  return {
    kind: ['DOG', 'CAT', 'BIRD', 'OTHER'].includes(kind) ? kind : 'OTHER',
    pose: ['SITTING', 'STANDING', 'LYING'].includes(pose) ? pose : '',
    breed: String(one.breed ?? '').slice(0, 80),
    colours,
  };
}
