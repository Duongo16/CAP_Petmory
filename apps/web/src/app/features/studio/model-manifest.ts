import { ColorGroup } from '../../core/models/api.model';

/** A material zone declared up front in the manifest file. */
export interface DeclaredZone {
  name: string;
  labelDisplay: string;
  colorGroupAllowed: ColorGroup;
  required: boolean;
}

export interface BaseModel {
  code: string;
  name: string;
  kind: string;
  pose: string;
  file: string;
  ready: boolean;
  temporary?: boolean;
  /**
   * Nhom dang cua mo hinh.
   *
   * Dang len dung lai chinh tep mo hinh that, chi khac o cho ti le than duoc
   * nan lai, nen no khong them tep nao vao thu muc mo hinh.
   */
  styleGroup?: 'REALISTIC' | 'BLOCKY' | 'FELTED';

  /** Ten dang than muon nan, chi co nghia voi nhom dang len. */
  bodyShape?: string;
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
}
