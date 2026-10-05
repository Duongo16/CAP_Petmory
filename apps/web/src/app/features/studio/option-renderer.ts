import { Engine3d } from '../../shared/viewer-3d/engine-3d';

/** Mot phuong an can chup: mau nen, goc xoay va mau tung mang vat lieu. */
export interface OptionShot {
  key: string;
  path: string;
  rotateY: number;
  colorByZone: Record<string, string>;
}

/** Canh anh phuong an, du ro tren the ma van nhe. */
const EDGE = 360;

/**
 * Chup anh cho tung phuong an goi y (muc 15).
 *
 * Moi phuong an la mot mau nen trong thu vien to theo mau AI de xuat, nen anh
 * duoc ve tu chinh mo hinh 3D ma khach se dat, khong ton tien goi dich vu ve
 * anh. Dung mot khung ve an, chup lan luot roi giai phong ngay.
 */
export async function renderOptionShots(box: HTMLElement, shots: OptionShot[], background: string): Promise<Record<string, string>> {
  const engine = new Engine3d(box, { baseModel: background, maxPixelRatio: 1 });
  engine.setAutoRotate(false);
  const out: Record<string, string> = {};
  try {
    for (const shot of shots) {
      await engine.loadModel(shot.path, shot.rotateY);
      engine.applyZoneColors(shot.colorByZone);
      const taken = engine.captureAngles(['ISO'], EDGE);
      if (taken.ISO) {
        out[shot.key] = taken.ISO;
      }
    }
  } finally {
    engine.destroy();
  }
  return out;
}
