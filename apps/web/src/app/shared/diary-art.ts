/**
 * Bo do trang tri cua quyen so: kieu giay, hinh dan, kieu chu.
 *
 * Moi thu o day la hinh ve san trong ma nguon, khong tai tu dau ve, nen
 * quyen so mo duoc ngay ca khi mang cham va khong phu thuoc dich vu nao.
 */

/** Cac kieu giay cua mot trang, dung dung ten may chu nhan. */
export type PaperKind = 'CREAM' | 'KRAFT' | 'DOT' | 'LINE' | 'GRID' | 'BLOOM';

export const PAPER_ORDER: PaperKind[] = ['CREAM', 'KRAFT', 'DOT', 'LINE', 'GRID', 'BLOOM'];

/** Ten hien cua tung kieu giay, viet san de khong bao gio ghep chuoi. */
export const PAPER_KEY: Record<PaperKind, string> = {
  CREAM: 'BOOK.PAPER.CREAM',
  KRAFT: 'BOOK.PAPER.KRAFT',
  DOT: 'BOOK.PAPER.DOT',
  LINE: 'BOOK.PAPER.LINE',
  GRID: 'BOOK.PAPER.GRID',
  BLOOM: 'BOOK.PAPER.BLOOM',
};

/** Ba kieu chu cho o chu tren trang. */
export type FontKey = 'HAND' | 'BODY' | 'SERIF';

export const FONT_ORDER: FontKey[] = ['HAND', 'BODY', 'SERIF'];

export const FONT_LABEL_KEY: Record<FontKey, string> = {
  HAND: 'BOOK.FONT.HAND',
  BODY: 'BOOK.FONT.BODY',
  SERIF: 'BOOK.FONT.SERIF',
};

/** Mot hinh trang tri, ve bang duong nam trong khung mot tram nhan mot tram. */
export interface Sticker {
  code: string;
  path: string;
}

/**
 * Bo hinh trang tri.
 *
 * Tat ca deu ve trong cung mot khung vuong mot tram, nen dat len trang thi
 * chung to nho theo dung mot cach va khong hinh nao bi meo.
 */
export const STICKERS: Sticker[] = [
  {
    code: 'heart',
    path: 'M50 86C20 66 8 50 8 34 8 20 19 10 32 10c8 0 14 4 18 10 4-6 10-10 18-10 13 0 24 10 24 24 0 16-12 32-42 52z',
  },
  {
    code: 'paw',
    path: 'M50 52c14 0 26 11 26 22 0 8-6 14-14 14H38c-8 0-14-6-14-14 0-11 12-22 26-22zM26 22c6 0 10 6 10 13s-4 13-10 13-10-6-10-13 4-13 10-13zm48 0c6 0 10 6 10 13s-4 13-10 13-10-6-10-13 4-13 10-13zM50 8c6 0 10 6 10 14s-4 14-10 14-10-6-10-14 4-14 10-14z',
  },
  {
    code: 'star',
    path: 'M50 8l12 26 28 4-20 20 5 28-25-13-25 13 5-28L10 38l28-4z',
  },
  {
    code: 'bone',
    path: 'M24 34c-8 0-14 6-14 13s6 13 14 13c2 0 4 0 6-2h40c2 2 4 2 6 2 8 0 14-6 14-13s-6-13-14-13c-2 0-4 0-6 2H30c-2-2-4-2-6-2z',
  },
  {
    code: 'fish',
    path: 'M14 50c12-18 32-26 48-26 8 0 14 2 18 6l-8 20 8 20c-4 4-10 6-18 6-16 0-36-8-48-26z',
  },
  {
    code: 'leaf',
    path: 'M82 14C46 14 18 34 18 62c0 10 4 18 10 24 4-24 22-42 46-50-18 12-30 28-34 48 28-2 42-28 42-70z',
  },
  {
    code: 'cloud',
    path: 'M28 70c-10 0-18-8-18-17s8-17 18-17c2-13 13-22 26-22 14 0 25 10 27 23 9 1 15 8 15 16 0 9-8 17-18 17z',
  },
  {
    code: 'sun',
    path: 'M50 28c12 0 22 10 22 22S62 72 50 72 28 62 28 50s10-22 22-22zM46 4h8v14h-8zm0 78h8v14h-8zM4 46h14v8H4zm78 0h14v8H82zM16 21l6-6 10 10-6 6zm52 52l6-6 10 10-6 6zM26 73l-10 10 6 6 10-10zm52-52L68 31l6 6 10-10z',
  },
  {
    code: 'tape',
    path: 'M6 34h88v32H6z',
  },
  {
    code: 'flower',
    path: 'M50 42c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9zm0-32c8 0 14 7 14 15 0 4-2 8-4 10 4-2 8-3 12-3 8 0 15 6 15 14s-7 14-15 14c-4 0-8-1-12-3 2 2 4 6 4 10 0 8-6 15-14 15s-14-7-14-15c0-4 2-8 4-10-4 2-8 3-12 3-8 0-15-6-15-14s7-14 15-14c4 0 8 1 12 3-2-2-4-6-4-10 0-8 6-15 14-15z',
  },
  {
    code: 'ball',
    path: 'M50 8c23 0 42 19 42 42S73 92 50 92 8 73 8 50 27 8 50 8zm0 10c-4 8-6 20-6 32s2 24 6 32c4-8 6-20 6-32s-2-24-6-32zM19 34c7 3 17 5 31 5s24-2 31-5c-3-6-8-11-14-13-5 6-11 10-17 10s-12-4-17-10c-6 2-11 7-14 13z',
  },
  {
    code: 'moon',
    path: 'M62 8c-4 0-8 1-12 2 16 6 26 21 26 40s-10 34-26 40c4 1 8 2 12 2 23 0 42-19 42-42S85 8 62 8z',
  },
];

/** Tim mot hinh theo ma. Ma la khong biet thi khong ve gi. */
export function stickerOf(code: string): Sticker | null {
  return STICKERS.find((one) => one.code === code) ?? null;
}

/** Bang mau cho chu va hinh trang tri, lay theo tong mau cua trang. */
export const DECOR_COLORS: string[] = [
  '#231a13',
  '#8a5a2b',
  '#b0413e',
  '#c2185b',
  '#7b4fa8',
  '#2f6f5e',
  '#1f6091',
  '#d79a2b',
];
