/**
 * Xoay va cat anh ngay tren trinh duyet, truoc khi gui len may chu.
 *
 * Moi phep bien doi deu chay tren mot khung ve ngoai man hinh, khong dung
 * den cay phan tu cua trang. Anh goc cua nguoi dung khong bao gio bi sua:
 * ham o day luon tra ve mot tep moi.
 */

/** Anh duoc xoay theo bao nhieu phan tu, tinh theo chieu kim dong ho. */
export type QuarterTurn = 0 | 1 | 2 | 3;

/** Vung giu lai, ghi theo phan tram so voi anh sau khi da xoay. */
export interface CropBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Be rong va be cao tinh bang diem anh. */
export interface Extent {
  width: number;
  height: number;
}

/** Be rong toi da cua anh xem truoc, du ro de ngam ma khong nang may. */
const PREVIEW_EDGE = 900;

/** Muc nen khi ghi lai anh dang JPEG, giu net ma khong phinh tep. */
const JPEG_QUALITY = 0.94;

/** Trinh duyet co du thu can de cat va xoay anh hay khong. */
export function canEditHere(): boolean {
  return typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function';
}

/**
 * Doc mot tep anh ra dang co the ve lai duoc.
 *
 * Huong ghi trong the cua may anh duoc ap ngay luc doc, nen anh chup doc tu
 * dien thoai khong con bi nam ngang.
 */
export function openBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** Kich thuoc cua anh sau khi xoay: xoay mot phan tu thi dai rong doi cho. */
export function turnedSize(bitmap: Extent, turn: QuarterTurn): Extent {
  const sideways = turn === 1 || turn === 3;
  return {
    width: sideways ? bitmap.height : bitmap.width,
    height: sideways ? bitmap.width : bitmap.height,
  };
}

/** Dat lai he toa do cua khung ve sao cho anh nam dung huong da xoay. */
function turnBrush(
  brush: OffscreenCanvasRenderingContext2D,
  turn: QuarterTurn,
  full: Extent,
): void {
  if (turn === 1) {
    brush.translate(full.width, 0);
    brush.rotate(Math.PI / 2);
  } else if (turn === 2) {
    brush.translate(full.width, full.height);
    brush.rotate(Math.PI);
  } else if (turn === 3) {
    brush.translate(0, full.height);
    brush.rotate(-Math.PI / 2);
  }
}

/** So diem anh that su con lai sau khi cat, lam tron ve so nguyen. */
export function cutExtent(bitmap: Extent, turn: QuarterTurn, box: CropBox): Extent {
  const full = turnedSize(bitmap, turn);
  return {
    width: Math.max(1, Math.round((full.width * box.width) / 100)),
    height: Math.max(1, Math.round((full.height * box.height) / 100)),
  };
}

/**
 * Ve phan da chon ra mot khung ve moi.
 *
 * Xoay va cat duoc lam trong cung mot luot ve, nen anh chi bi ghi lai mot
 * lan va khong mat net qua hai buoc.
 */
function paintCut(
  bitmap: ImageBitmap,
  turn: QuarterTurn,
  box: CropBox,
  scale: number,
): OffscreenCanvas {
  const full = turnedSize(bitmap, turn);
  const cut = cutExtent(bitmap, turn, box);
  const sheet = new OffscreenCanvas(
    Math.max(1, Math.round(cut.width * scale)),
    Math.max(1, Math.round(cut.height * scale)),
  );
  const brush = sheet.getContext('2d');
  if (!brush) {
    return sheet;
  }
  brush.scale(scale, scale);
  brush.translate(-(full.width * box.left) / 100, -(full.height * box.top) / 100);
  turnBrush(brush, turn, full);
  brush.drawImage(bitmap, 0, 0);
  return sheet;
}

/** Anh xem truoc cua ca tam sau khi xoay, thu nho lai cho nhe. */
export async function previewOf(bitmap: ImageBitmap, turn: QuarterTurn): Promise<Blob> {
  const full = turnedSize(bitmap, turn);
  const scale = Math.min(1, PREVIEW_EDGE / Math.max(full.width, full.height));
  const whole: CropBox = { left: 0, top: 0, width: 100, height: 100 };
  return paintCut(bitmap, turn, whole, scale).convertToBlob({ type: 'image/png' });
}

/**
 * Tep anh moi sau khi xoay va cat.
 *
 * Dang tep duoc giu nguyen nhu ban goc: anh JPEG ra JPEG, anh PNG ra PNG.
 * Doi dang se lam may chu tu choi, va cung lam nguoi dung mat trong suot.
 */
export async function cutOut(
  file: File,
  bitmap: ImageBitmap,
  turn: QuarterTurn,
  box: CropBox,
): Promise<File> {
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await paintCut(bitmap, turn, box, 1).convertToBlob({
    type,
    quality: type === 'image/jpeg' ? JPEG_QUALITY : undefined,
  });
  return new File([blob], file.name, { type, lastModified: Date.now() });
}
