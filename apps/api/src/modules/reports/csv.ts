/**
 * Dung tep CSV cho cac bao cao quan tri.
 *
 * Tep duoc mo bang Excel, nen phai co dau nhan dau tep. Khong co dau do,
 * Excel doc tep theo bang ma cua may va moi chu tieng Viet co dau deu vo ra
 * thanh ky tu la. Day la yeu cau cua muc 22 khoan 9.
 */

/** Dau nhan dau tep, bao cho Excel biet tep viet bang bang ma quoc te. */
const BOM = '﻿';

/** Dau xuong dong kieu Windows, vi Excel tren Windows doc quen dang nay. */
const LINE_END = String.fromCharCode(13) + String.fromCharCode(10);

/**
 * Boc mot o cho an toan.
 *
 * O nao co dau phay, dau nhay hoac xuong dong deu phai duoc boc trong dau
 * nhay, neu khong thi mot o se bi tach thanh nhieu cot va ca bang lech theo.
 */
function cell(raw: unknown): string {
  const text = raw === null || raw === undefined ? '' : String(raw);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Dung mot tep CSV tu dong tieu de va cac dong du lieu. */
export function asCsv(head: string[], rows: unknown[][]): string {
  const lines = [head.map(cell).join(','), ...rows.map((row) => row.map(cell).join(','))];
  return BOM + lines.join(LINE_END) + LINE_END;
}
