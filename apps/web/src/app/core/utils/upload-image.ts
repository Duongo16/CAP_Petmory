/**
 * Chuan bi mot tam anh tren may truoc khi gui len may chu.
 *
 * May chu chi nhan anh JPG hoac PNG va gioi han dung luong moi tam. Anh chup
 * tu dien thoai doi moi thuong vuot gioi han, con anh tai tren mang hay o dang
 * WebP. Ham o day doc anh ngay tren trinh duyet, thu nho cho canh dai nhat con
 * vua du net cho xuong, roi ghi lai dang JPG, nen nguoi dung khong phai tu doi
 * anh. Anh gon san thi gui nguyen, khong ghi lai.
 */

/** Dung luong toi da gui di, de mot khoang duoi gioi han cua may chu. */
export const UPLOAD_MAX_BYTES = 9 * 1024 * 1024;

/** Canh dai nhat sau khi thu nho, van du net de xuong lam theo anh. */
export const UPLOAD_MAX_EDGE = 4096;

/** Hai dang may chu nhan thang. */
const READY_TYPES = ['image/jpeg', 'image/png'];

/** Cac muc nen thu lan luot cho toi khi tep vua dung luong. */
const QUALITY_STEPS = [0.9, 0.85, 0.78, 0.7];

/** Duoi tep cua cac dang anh hay gap, ke ca khi trinh duyet khong bao dang tep. */
const IMAGE_ENDING = /\.(jpe?g|png|webp|heic|heif|avif|bmp|gif)$/i;

/** Gioi han rieng cho tung cho gui anh; de trong thi dung muc chung o tren. */
export interface UploadFit {
  maxBytes?: number;
  maxEdge?: number;
}

/** Tep goc lon nhat nhan vao de thu nho; lon hon nua thi trinh duyet de bi treo. */
export const PICK_MAX_BYTES = 60 * 1024 * 1024;

/** Trinh duyet khong doc duoc tam anh nay, thuong la anh HEIC tren may khong phai iPhone. */
export class ImageUnreadable extends Error {
  constructor(readonly fileName: string) {
    super(`Khong doc duoc anh ${fileName}`);
    this.name = 'ImageUnreadable';
  }
}

/** Tep nay co ve la mot tam anh, xet ca dang tep lan duoi ten tep. */
export function looksLikeImage(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_ENDING.test(file.name);
}

/** Ten tep moi khi doi dang, giu ten goc va doi duoi tep. */
function renamed(name: string, ending: string): string {
  const at = name.lastIndexOf('.');
  return `${at > 0 ? name.slice(0, at) : name}.${ending}`;
}

/** Ve lai anh o mot kich co, ghi ra dang da chon. */
async function drawAs(bitmap: ImageBitmap, edge: number, type: string, quality?: number): Promise<Blob> {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const sheet = new OffscreenCanvas(width, height);
  const brush = sheet.getContext('2d');
  if (!brush) {
    throw new Error('Trinh duyet khong ve duoc anh');
  }
  if (type === 'image/jpeg') {
    // Anh JPG khong co nen trong suot, lot nen trang de vung trong khong bi den.
    brush.fillStyle = '#ffffff';
    brush.fillRect(0, 0, width, height);
  }
  brush.drawImage(bitmap, 0, 0, width, height);
  return sheet.convertToBlob({ type, quality });
}

/**
 * Tra ve tam anh san sang gui di.
 *
 * Anh JPG hoac PNG da vua dung luong thi tra nguyen. Con lai thi doc ra, thu
 * nho va ghi lai; PNG giu dang PNG neu van vua, khong thi chuyen sang JPG.
 * Trinh duyet khong doc duoc anh thi bao bang loi rieng de man hinh noi ro.
 */
export async function fitForUpload(file: File, fit: UploadFit = {}): Promise<File> {
  const maxBytes = fit.maxBytes ?? UPLOAD_MAX_BYTES;
  const maxEdge = fit.maxEdge ?? UPLOAD_MAX_EDGE;
  if (READY_TYPES.includes(file.type) && file.size <= maxBytes && !fit.maxEdge) {
    return file;
  }
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageUnreadable(file.name);
  }
  try {
    if (file.type === 'image/png') {
      const png = await drawAs(bitmap, maxEdge, 'image/png');
      if (png.size <= maxBytes) {
        return new File([png], file.name, { type: 'image/png', lastModified: Date.now() });
      }
    }
    let edge = maxEdge;
    for (let round = 0; round < 4; round += 1) {
      for (const quality of QUALITY_STEPS) {
        const jpeg = await drawAs(bitmap, edge, 'image/jpeg', quality);
        if (jpeg.size <= maxBytes) {
          return new File([jpeg], renamed(file.name, 'jpg'), { type: 'image/jpeg', lastModified: Date.now() });
        }
      }
      edge = Math.round(edge * 0.75);
    }
    throw new Error('Khong thu nho duoc anh xuong duoi gioi han');
  } finally {
    bitmap.close();
  }
}
