/**
 * Cac lua chon cua de trung bay, dung chung cho khung ba chieu va trang tuy bien.
 *
 * Ma o day phai trung voi danh sach ma may chu chap nhan. Mau la mau hien thi
 * tren mo hinh ba chieu, khong phai mau giao dien, nen khai bao thang o day.
 */

export type StandShape = 'ROUND' | 'SQUARE';

export type StandTone = 'OAK' | 'WALNUT' | 'CHERRY' | 'BIRCH' | 'PINK' | 'MINT';

export type StandDecoration = 'FLOWERS' | 'HEART' | 'BONE' | 'FISH' | 'YARN_BALL' | 'MUSHROOM';

export interface StandToneOption {
  code: StandTone;
  hex: string;
  /** Go son mau thi van go mo hon go moc. */
  painted: boolean;
  key: string;
}

export const STAND_TONES: StandToneOption[] = [
  { code: 'OAK', hex: '#c8955c', painted: false, key: 'STUDIO.STAND.TONE.OAK' },
  { code: 'WALNUT', hex: '#6f4528', painted: false, key: 'STUDIO.STAND.TONE.WALNUT' },
  { code: 'CHERRY', hex: '#a4573a', painted: false, key: 'STUDIO.STAND.TONE.CHERRY' },
  { code: 'BIRCH', hex: '#e6d3b3', painted: false, key: 'STUDIO.STAND.TONE.BIRCH' },
  { code: 'PINK', hex: '#eab9bf', painted: true, key: 'STUDIO.STAND.TONE.PINK' },
  { code: 'MINT', hex: '#acd5c0', painted: true, key: 'STUDIO.STAND.TONE.MINT' },
];

export const STAND_DECORATIONS: { code: StandDecoration; key: string }[] = [
  { code: 'FLOWERS', key: 'STUDIO.STAND.DECOR.FLOWERS' },
  { code: 'HEART', key: 'STUDIO.STAND.DECOR.HEART' },
  { code: 'BONE', key: 'STUDIO.STAND.DECOR.BONE' },
  { code: 'FISH', key: 'STUDIO.STAND.DECOR.FISH' },
  { code: 'YARN_BALL', key: 'STUDIO.STAND.DECOR.YARN_BALL' },
  { code: 'MUSHROOM', key: 'STUDIO.STAND.DECOR.MUSHROOM' },
];

/** Moi de co bon cho dat do trang tri quanh chan be. */
export const STAND_DECORATION_MAX = 4;

/** Ma de khong co de. */
export const BASE_NONE = 'BASE-NONE';

/** Hinh dang cua tung ma de trong danh muc. Ma moi chua khai bao thi ve dang tron. */
const SHAPE_OF_BASE: Record<string, StandShape> = {
  'BASE-ROUND': 'ROUND',
  'BASE-SQUARE': 'SQUARE',
};

export function shapeOfBase(code: string): StandShape | null {
  if (!code || code === BASE_NONE) {
    return null;
  }
  return SHAPE_OF_BASE[code] ?? 'ROUND';
}

/** Nhung gi khung ba chieu can de ve de. */
export interface StandView {
  shape: StandShape;
  tone: StandToneOption;
  decorations: StandDecoration[];
  /** Dong chu lon khac tren de. */
  name: string;
  /** Dong chu nho ben duoi, da dinh dang san. */
  line: string;
}
