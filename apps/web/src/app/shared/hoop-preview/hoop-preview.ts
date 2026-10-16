import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Kieu khung: vong theu tron, hoac khung tranh vuong, nam ngang, dung doc. */
export type FrameShape = 'ROUND' | 'SQUARE' | 'LANDSCAPE' | 'PORTRAIT';

/** Mau khung. Hai loai go co van, ba loai son tron. */
export type FrameFinish = 'WALNUT' | 'OAK' | 'WHITE' | 'BLACK' | 'ROSE';

export const FRAME_SHAPES: FrameShape[] = ['ROUND', 'SQUARE', 'LANDSCAPE', 'PORTRAIT'];
export const FRAME_FINISHES: FrameFinish[] = ['WALNUT', 'OAK', 'WHITE', 'BLACK', 'ROSE'];

/** Loai go thi phu van, loai son thi de tron. */
const GRAINED: ReadonlySet<FrameFinish> = new Set(['WALNUT', 'OAK']);

/** Khoang trong phia tren khung de ve moc treo. */
const TOP = 64;
/** Le hai ben va phia duoi, du cho bong do. */
const SIDE = 12;
const BOTTOM = 16;

/** Ngoai kich va be day vien cua tung kieu, theo don vi cua khung ve. */
const SIZE: Record<FrameShape, { width: number; height: number; band: number }> = {
  ROUND: { width: 272, height: 272, band: 17 },
  SQUARE: { width: 264, height: 264, band: 20 },
  LANDSCAPE: { width: 320, height: 240, band: 20 },
  PORTRAIT: { width: 232, height: 300, band: 20 },
};

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Hinh hoc cua mot khung: vien, lo de lo vai, cho dat be va moc treo. */
interface FrameGeometry {
  viewBox: string;
  width: number;
  height: number;
  round: boolean;
  /** Vien khung: hinh ngoai tru hinh trong, to theo luat evenodd. */
  band: string;
  /** Mep trong cua vien, cung la mep vai. */
  opening: string;
  /** Mep ngoai cua vien. */
  outline: string;
  /** Duong cheo noi goc trong voi goc ngoai, giong mach ghep cua khung tranh. */
  mitres: string;
  cloth: Box;
  /** O vuong dat anh be, can giua vai. */
  pet: Box;
  centerX: number;
  /** Dinh cua vien, noi gan khoa vit hay buoc day treo. */
  top: number;
  /** Day treo cua khung tranh: tu sau mep tren, vat qua dinh, ve lai mep tren. */
  twine: string;
}

function circle(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
}

function rect(box: Box): string {
  return `M ${box.x} ${box.y} h ${box.width} v ${box.height} h ${-box.width} Z`;
}

function geometryOf(shape: FrameShape): FrameGeometry {
  const { width, height, band } = SIZE[shape];
  const totalWidth = width + SIDE * 2;
  const totalHeight = TOP + height + BOTTOM;
  const centerX = totalWidth / 2;
  const outer: Box = { x: SIDE, y: TOP, width, height };
  const cloth: Box = { x: SIDE + band, y: TOP + band, width: width - band * 2, height: height - band * 2 };
  const edge = Math.min(cloth.width, cloth.height) * 0.86;
  const pet: Box = {
    x: cloth.x + (cloth.width - edge) / 2,
    y: cloth.y + (cloth.height - edge) / 2,
    width: edge,
    height: edge,
  };
  const twine = [
    [cloth.x + cloth.width * 0.2, TOP + 6],
    [centerX, TOP - 42],
    [cloth.x + cloth.width * 0.8, TOP + 6],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
  const common = {
    viewBox: `0 0 ${totalWidth} ${totalHeight}`,
    width: totalWidth,
    height: totalHeight,
    cloth,
    pet,
    centerX,
    top: TOP,
    twine,
  };

  if (shape === 'ROUND') {
    const cy = TOP + height / 2;
    const r = width / 2;
    const opening = circle(centerX, cy, r - band);
    const outline = circle(centerX, cy, r);
    return { ...common, round: true, band: `${outline} ${opening}`, opening, outline, mitres: '' };
  }

  const opening = rect(cloth);
  const outline = rect(outer);
  const corners = [
    [outer.x, outer.y, cloth.x, cloth.y],
    [outer.x + outer.width, outer.y, cloth.x + cloth.width, cloth.y],
    [outer.x + outer.width, outer.y + outer.height, cloth.x + cloth.width, cloth.y + cloth.height],
    [outer.x, outer.y + outer.height, cloth.x, cloth.y + cloth.height],
  ];
  const mitres = corners.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`).join(' ');
  return { ...common, round: false, band: `${outline} ${opening}`, opening, outline, mitres };
}

/** Moi khung mot bo ten rieng cho bo loc SVG, de hai khung tren cung trang khong dung nhau. */
let serial = 0;

/**
 * Anh xem truoc thanh pham: dau len da chọc, dinh tren vai lanh, dong khung.
 *
 * Chi la anh minh hoa. Anh be lay tu khung 3D nhin thang, nen trong suot; khung
 * phu lop xo len o mep va vet soi len mat de giong len chọc hon la nhua. Khung,
 * vai va moc treo ve bang SVG, mau lay tu bien --pm-frame-* va --pm-hoop-*.
 */
@Component({
  selector: 'pm-hoop-preview',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './hoop-preview.html',
  styleUrl: './hoop-preview.scss',
  host: { '[attr.data-finish]': 'finish()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HoopPreview {
  /** Anh be nen trong suot (data URL). Rong la dang chuan bi anh. */
  readonly photo = input<string | null>(null);
  readonly shape = input<FrameShape>('ROUND');
  readonly finish = input<FrameFinish>('WALNUT');

  protected readonly id = `pm-hoop-${(serial += 1)}`;
  protected readonly frame = computed(() => geometryOf(this.shape()));
  protected readonly grained = computed(() => GRAINED.has(this.finish()));

  protected url(name: string): string {
    return `url(#${this.id}-${name})`;
  }
}
