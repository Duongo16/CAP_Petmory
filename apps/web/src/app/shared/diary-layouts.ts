import { DecorItem } from '../core/models/api.model';
import { DECOR_COLORS, FontKey, PaperKind } from './diary-art';

/**
 * Ready-made arrangements of photographs and words for one diary page.
 *
 * Each layout is written as page items in percent of the page, the same units
 * the page editor stores, so a page made from a layout opens in the editor and
 * in the public diary exactly as it was chosen, and can still be moved around
 * afterwards. Photographs are drawn in a fixed four by three frame, which is
 * what makes the heights below predictable.
 */

export type LayoutCode = 'HERO' | 'DUO' | 'TRIO' | 'GRID' | 'STORY' | 'NOTE';

interface PhotoSlot {
  x: number;
  y: number;
  width: number;
  rotate: number;
}

interface TextSlot {
  x: number;
  y: number;
  width: number;
  font: FontKey;
  /** How many characters fit in this box before it would run off the page. */
  limit: number;
}

interface StickerSlot {
  code: string;
  x: number;
  y: number;
  width: number;
  rotate: number;
  color: string;
}

export interface DiaryLayout {
  code: LayoutCode;
  nameKey: string;
  textKey: string;
  paper: PaperKind;
  photos: PhotoSlot[];
  title: TextSlot;
  body: TextSlot;
  stickers: StickerSlot[];
}

const RED = DECOR_COLORS[2];
const BROWN = DECOR_COLORS[1];
const GREEN = DECOR_COLORS[5];

export const DIARY_LAYOUTS: DiaryLayout[] = [
  {
    code: 'HERO',
    nameKey: 'BOOK.LAYOUT.HERO.NAME',
    textKey: 'BOOK.LAYOUT.HERO.TEXT',
    paper: 'CREAM',
    photos: [{ x: 8, y: 5, width: 84, rotate: -1.5 }],
    title: { x: 8, y: 62, width: 84, font: 'HAND', limit: 60 },
    body: { x: 8, y: 71, width: 84, font: 'BODY', limit: 220 },
    stickers: [{ code: 'heart', x: 82, y: 1, width: 12, rotate: 14, color: RED }],
  },
  {
    code: 'DUO',
    nameKey: 'BOOK.LAYOUT.DUO.NAME',
    textKey: 'BOOK.LAYOUT.DUO.TEXT',
    paper: 'DOT',
    photos: [
      { x: 5, y: 5, width: 54, rotate: -4 },
      { x: 41, y: 25, width: 54, rotate: 4 },
    ],
    title: { x: 7, y: 63, width: 86, font: 'HAND', limit: 60 },
    body: { x: 7, y: 72, width: 86, font: 'BODY', limit: 200 },
    stickers: [{ code: 'paw', x: 8, y: 42, width: 11, rotate: -12, color: BROWN }],
  },
  {
    code: 'TRIO',
    nameKey: 'BOOK.LAYOUT.TRIO.NAME',
    textKey: 'BOOK.LAYOUT.TRIO.TEXT',
    paper: 'KRAFT',
    photos: [
      { x: 4, y: 4, width: 46, rotate: -5 },
      { x: 50, y: 7, width: 45, rotate: 4 },
      { x: 25, y: 33, width: 50, rotate: -1 },
    ],
    title: { x: 7, y: 68, width: 86, font: 'HAND', limit: 50 },
    body: { x: 7, y: 77, width: 86, font: 'BODY', limit: 150 },
    stickers: [{ code: 'star', x: 82, y: 38, width: 11, rotate: 10, color: BROWN }],
  },
  {
    code: 'GRID',
    nameKey: 'BOOK.LAYOUT.GRID.NAME',
    textKey: 'BOOK.LAYOUT.GRID.TEXT',
    paper: 'GRID',
    photos: [
      { x: 5, y: 5, width: 43, rotate: -1 },
      { x: 52, y: 5, width: 43, rotate: 1 },
      { x: 5, y: 35, width: 43, rotate: 1 },
      { x: 52, y: 35, width: 43, rotate: -1 },
    ],
    title: { x: 7, y: 66, width: 86, font: 'SERIF', limit: 60 },
    body: { x: 7, y: 75, width: 86, font: 'BODY', limit: 160 },
    stickers: [],
  },
  {
    code: 'STORY',
    nameKey: 'BOOK.LAYOUT.STORY.NAME',
    textKey: 'BOOK.LAYOUT.STORY.TEXT',
    paper: 'LINE',
    photos: [{ x: 22, y: 50, width: 60, rotate: 3 }],
    title: { x: 8, y: 6, width: 84, font: 'SERIF', limit: 60 },
    body: { x: 8, y: 15, width: 84, font: 'HAND', limit: 260 },
    stickers: [{ code: 'leaf', x: 6, y: 80, width: 13, rotate: -18, color: GREEN }],
  },
  {
    code: 'NOTE',
    nameKey: 'BOOK.LAYOUT.NOTE.NAME',
    textKey: 'BOOK.LAYOUT.NOTE.TEXT',
    paper: 'BLOOM',
    photos: [],
    title: { x: 10, y: 10, width: 72, font: 'HAND', limit: 60 },
    body: { x: 10, y: 22, width: 80, font: 'HAND', limit: 520 },
    stickers: [
      { code: 'flower', x: 80, y: 4, width: 14, rotate: 12, color: RED },
      { code: 'paw', x: 10, y: 84, width: 10, rotate: -14, color: BROWN },
    ],
  },
];

export function layoutOf(code: LayoutCode): DiaryLayout {
  return DIARY_LAYOUTS.find((one) => one.code === code) ?? DIARY_LAYOUTS[0];
}

function cut(text: string, limit: number): string {
  const clean = text.trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * Lays the chosen photographs and words out on a page.
 *
 * Photographs fill the slots in the order they were picked; a slot with no
 * photograph is simply left out. The full story stays in the moment itself;
 * the page shows as much of it as its box holds.
 */
export function buildPage(layout: DiaryLayout, photoIds: string[], title: string, body: string): DecorItem[] {
  const items: DecorItem[] = [];
  let z = 1;
  const blank = { text: '', photo: null, sticker: '', color: '', fontKey: '' };

  layout.photos.forEach((slot, at) => {
    const photo = photoIds[at];
    if (photo) {
      items.push({ ...blank, kind: 'PHOTO', x: slot.x, y: slot.y, width: slot.width, rotate: slot.rotate, z: z++, photo });
    }
  });
  if (title.trim()) {
    const slot = layout.title;
    items.push({
      ...blank,
      kind: 'TEXT',
      x: slot.x,
      y: slot.y,
      width: slot.width,
      rotate: 0,
      z: z++,
      text: cut(title, slot.limit),
      fontKey: slot.font,
    });
  }
  if (body.trim()) {
    const slot = layout.body;
    items.push({
      ...blank,
      kind: 'TEXT',
      x: slot.x,
      y: slot.y,
      width: slot.width,
      rotate: 0,
      z: z++,
      text: cut(body, slot.limit),
      fontKey: slot.font,
    });
  }
  for (const slot of layout.stickers) {
    items.push({
      ...blank,
      kind: 'STICKER',
      x: slot.x,
      y: slot.y,
      width: slot.width,
      rotate: slot.rotate,
      z: z++,
      sticker: slot.code,
      color: slot.color,
    });
  }
  return items;
}
