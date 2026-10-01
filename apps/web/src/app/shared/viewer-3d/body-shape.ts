/**
 * Cac dang than co san cho mo hinh that.
 *
 * Bo mo hinh that dat ten xuong giong nhau tren moi con vat, nen mot bang he so
 * dung duoc cho ca bo. Nhan mot he so lon hon mot thi phan do to ra, nho hon
 * mot thi thu lai.
 *
 * Muc dich la keo dang con vat ve gan san pham len choc: dau to, than day, chan
 * ngan, nhung cau truc van la con vat that chu khong thanh khoi vuong.
 *
 * Ten dang la mot danh sach dong. Tep danh muc chi duoc ghi mot trong nhung ten
 * o day. Ten la se bi bo qua chu khong duoc dien thang thanh he so.
 */

/** Ten cac dang than duoc phep ghi trong tep danh muc. */
export type BodyShapeName = 'FELTED_SOFT' | 'FELTED_ROUND';

/** Mot bang he so: khoa la ten xuong, gia tri la he so nhan vao ti le goc. */
export type BodyShape = Record<string, number>;

/** Dang len nhe: van ra dang con vat that, chi tron hon mot chut. */
const FELTED_SOFT: BodyShape = {
  Head: 1.45,
  Neck1: 0.9,
  Torso: 1.16,
  Torso2: 1.12,
  Torso3: 1.08,
  'FrontUpperLeg.L': 0.8,
  'FrontUpperLeg.R': 0.8,
  'BackUpperLeg.L': 0.8,
  'BackUpperLeg.R': 0.8,
  'Ear1.L': 1.12,
  'Ear1.R': 1.12,
};

/** Dang len dam: dau to han, than tron han, gan dang thu bong nhat. */
const FELTED_ROUND: BodyShape = {
  Head: 1.8,
  Neck1: 0.78,
  Neck2: 0.88,
  Torso: 1.32,
  Torso2: 1.24,
  Torso3: 1.14,
  'FrontUpperLeg.L': 0.64,
  'FrontUpperLeg.R': 0.64,
  'BackUpperLeg.L': 0.64,
  'BackUpperLeg.R': 0.64,
  'Ear1.L': 1.22,
  'Ear1.R': 1.22,
};

const TABLE: Record<BodyShapeName, BodyShape> = { FELTED_SOFT, FELTED_ROUND };

/**
 * Tra bang he so cua mot dang than.
 *
 * Ten khong nam trong danh sach thi tra ve bang rong, nghia la giu nguyen dang
 * goc cua tep mo hinh.
 */
export function bodyShapeOf(name: string | null | undefined): BodyShape {
  if (!name) {
    return {};
  }
  return TABLE[name as BodyShapeName] ?? {};
}
