import { ColorGroup } from '../../core/models/api.model';

/** A material zone declared up front in the manifest file. */
export interface DeclaredZone {
  name: string;
  labelDisplay: string;
  colorGroupAllowed: ColorGroup;
  required: boolean;
}

/** Nguon cua mot tep mo hinh, de ghi ten tac gia dung giay phep. */
export interface ModelCredit {
  author: string;
  licence: string;
  source: string;
}

export interface BaseModel {
  code: string;
  name: string;
  kind: string;
  pose: string;
  file: string;
  ready: boolean;
  /** Dang that hay dang khoi vuong. */
  styleGroup?: 'REALISTIC' | 'BLOCKY';
  /** Goc xoay quanh truc dung, do theo do, de con vat quay mat ve phia truoc. */
  rotateY?: number;
  credit?: ModelCredit;
  /** Thuoc thu vien mau nen theo muc 6: du sau vung va co diem neo phu kien. */
  core?: boolean;
  /** Ban day du cho xuong. Rong thi xuong dung chung tep voi trang khach. */
  fileFull?: string;
  /** Ten cac diem neo phu kien co trong tep. */
  anchors?: string[];
}

/**
 * Sau vung co ten ma hop dong yeu cau.
 *
 * Khac voi ten mang vat lieu trong tep mo hinh: moi tac gia dat ten mot kieu,
 * co tep con dat la "Material.001". Ban do duoi day noi mang nao thuoc vung
 * nao, va nho vay ho so san xuat ghi duoc ma mau theo vung.
 */
export type ZoneName = 'MAIN_FUR' | 'BELLY_FUR' | 'EAR' | 'TAIL' | 'EYE' | 'NOSE';

export interface ModelLibrary {
  version: number;
  description: string;
  zoneMaterial: DeclaredZone[];
  baseModel: BaseModel[];
  /** Sau vung co ten, theo thu tu hien tren ho so san xuat. */
  zoneName?: ZoneName[];
  /** Ban do ten mang vat lieu sang vung co ten, tra theo ten tep mo hinh. */
  zoneByFile?: Record<string, Record<string, ZoneName>>;
  /**
   * Ma mau da bo, tro sang mau thay the.
   *
   * Ban thiet ke cu van giu ma cu, nen khi mo lai phai doi sang mau dang con
   * thay vi roi ve mau dau tien trong danh sach.
   */
  retired?: Record<string, string>;
}

/** Ma mau dang con dung cho mot ma co the da bo. */
export function currentModelCode(code: string, library: Pick<ModelLibrary, 'retired'>): string {
  return library.retired?.[code] ?? code;
}
