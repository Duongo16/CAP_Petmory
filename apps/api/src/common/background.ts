import { waitUntil } from '@vercel/functions';

/**
 * Chay mot viec sau khi da tra loi nguoi goi.
 *
 * Tren may chu thuong, tien trinh song tiep nen viec do cu the chay. Tren nen
 * tang chay theo tung yeu cau, tien trinh bi dung ngay sau khi tra loi, nen
 * phai bao truoc cho nen tang giu lai cho toi khi viec do xong.
 */
export function runInBackground(work: Promise<unknown>): void {
  if (process.env.VERCEL) {
    waitUntil(work);
  }
}
