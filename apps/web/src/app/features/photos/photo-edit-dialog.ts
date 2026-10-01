import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import {
  CropBox,
  Extent,
  QuarterTurn,
  canEditHere,
  cutExtent,
  cutOut,
  openBitmap,
  previewOf,
  turnedSize,
} from './image-edit';

/** Nhung anh vua chon, kem nguong canh bao lay tu tham so nghiep vu. */
export interface PhotoEditRequest {
  files: File[];
  goodShortEdgePx: number;
}

/** Ba kieu khung cat cho nguoi dung chon. */
export type CropShape = 'FREE' | 'SQUARE' | 'FOUR_THREE';

/** Ti le cao tren rong cua tung kieu khung. Khung tu do khong rang buoc gi. */
const SHAPE_RATIO: Record<CropShape, number | null> = {
  FREE: null,
  SQUARE: 1,
  FOUR_THREE: 3 / 4,
};

/** Ten hien cua tung kieu khung, viet san de khong bao gio ghep chuoi. */
const SHAPE_KEY: Record<CropShape, string> = {
  FREE: 'PHOTO.EDIT.SHAPE_FREE',
  SQUARE: 'PHOTO.EDIT.SHAPE_SQUARE',
  FOUR_THREE: 'PHOTO.EDIT.SHAPE_FOUR_THREE',
};

const SHAPE_ORDER: CropShape[] = ['FREE', 'SQUARE', 'FOUR_THREE'];

/** Phan nho nhat cua anh con duoc phep giu lai, tinh theo phan tram. */
const KEEP_LEAST = 20;

/**
 * Sua anh truoc khi gui: xoay theo tung phan tu vong va cat bot ria.
 *
 * Moi thu lam tren may cua nguoi dung. Anh chi roi may khi ho bam gui, va
 * anh da nam trong album thi khong mo duoc hop nay nua, vi sua anh da dung
 * cho mot don hang se lam sai ho so san xuat.
 */
@Component({
  selector: 'pm-photo-edit-dialog',
  standalone: true,
  imports: [TranslatePipe, Icon],
  templateUrl: './photo-edit-dialog.html',
  styleUrl: './photo-edit-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoEditDialog implements OnInit {
  private readonly ref = inject(MatDialogRef<PhotoEditDialog, File[]>);
  private readonly data = inject<PhotoEditRequest>(MAT_DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);

  readonly shapes = SHAPE_ORDER.map((shape) => ({ value: shape, key: SHAPE_KEY[shape] }));
  readonly total = this.data.files.length;
  readonly supported = canEditHere();

  readonly at = signal(0);
  readonly turn = signal<QuarterTurn>(0);
  readonly shape = signal<CropShape>('FREE');
  readonly keepWidth = signal(100);
  readonly keepHeight = signal(100);
  readonly slideX = signal(50);
  readonly slideY = signal(50);
  readonly loading = signal(true);
  readonly working = signal(false);
  readonly preview = signal('');

  private bitmap: ImageBitmap | null = null;
  private readonly kept: File[] = [];
  private readonly size = signal<Extent>({ width: 0, height: 0 });

  private readonly cleanup = this.destroyRef.onDestroy(() => this.dropPreview());

  /** Ten tep dang sua, de nguoi dung biet minh dang o buc nao. */
  readonly fileName = computed(() => this.data.files[this.at()]?.name ?? '');

  /** So diem anh con lai sau khi cat, tren anh that chu khong tren anh xem truoc. */
  readonly cutSize = computed<Extent>(() =>
    cutExtent(this.size(), this.turn(), this.box()),
  );

  /** Canh ngan cua phan giu lai. Day la con so quyet dinh anh con dung duoc khong. */
  readonly shortSide = computed(() => Math.min(this.cutSize().width, this.cutSize().height));

  /** Cat sau qua thi canh ngan tut xuong duoi nguong, bao ngay tai cho. */
  readonly tooSmall = computed(() => this.shortSide() < this.data.goodShortEdgePx);

  readonly threshold = this.data.goodShortEdgePx;

  /** Vung giu lai, quy ve phan tram de ve khung va de cat. */
  readonly box = computed<CropBox>(() => {
    const width = this.keepWidth();
    const height = this.keepHeight();
    return {
      left: ((100 - width) * this.slideX()) / 100,
      top: ((100 - height) * this.slideY()) / 100,
      width,
      height,
    };
  });

  ngOnInit(): void {
    this.load();
  }

  /** Doc anh dang xem ra bo nho va dung anh xem truoc dau tien. */
  private load(): void {
    const file = this.data.files[this.at()];
    if (!file || !this.supported) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    openBitmap(file)
      .then((bitmap) => {
        this.bitmap = bitmap;
        this.size.set({ width: bitmap.width, height: bitmap.height });
        return this.redraw();
      })
      .catch(() => this.loading.set(false));
  }

  /** Ve lai anh xem truoc sau moi lan xoay. */
  private async redraw(): Promise<void> {
    if (!this.bitmap) {
      return;
    }
    const blob = await previewOf(this.bitmap, this.turn());
    this.dropPreview();
    this.preview.set(URL.createObjectURL(blob));
    this.loading.set(false);
  }

  private dropPreview(): void {
    const old = this.preview();
    if (old) {
      URL.revokeObjectURL(old);
    }
  }

  turnLeft(): void {
    this.turn.set(((this.turn() + 3) % 4) as QuarterTurn);
    this.afterTurn();
  }

  turnRight(): void {
    this.turn.set(((this.turn() + 1) % 4) as QuarterTurn);
    this.afterTurn();
  }

  private afterTurn(): void {
    this.fitShape();
    void this.redraw();
  }

  pickShape(shape: CropShape): void {
    this.shape.set(shape);
    this.fitShape();
  }

  /** Doi be rong phan giu lai. Khung co ti le thi be cao chay theo. */
  setWidth(event: Event): void {
    this.keepWidth.set(this.withinRange(event));
    this.fitShape();
  }

  setHeight(event: Event): void {
    this.keepHeight.set(this.withinRange(event));
  }

  setSlideX(event: Event): void {
    this.slideX.set(this.withinRange(event, 0));
  }

  setSlideY(event: Event): void {
    this.slideY.set(this.withinRange(event, 0));
  }

  private withinRange(event: Event, least = KEEP_LEAST): number {
    const asked = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(asked)) {
      return least;
    }
    return Math.min(100, Math.max(least, Math.round(asked)));
  }

  /**
   * Keo be cao theo ti le cua khung da chon.
   *
   * Ti le tinh tren so diem anh that, khong tinh tren phan tram, vi mot buc
   * anh nam ngang thi giu bay muoi phan tram be rong khong he bang bay muoi
   * phan tram be cao.
   */
  private fitShape(): void {
    const wanted = SHAPE_RATIO[this.shape()];
    if (wanted === null) {
      return;
    }
    const full = turnedSize(this.size(), this.turn());
    if (full.width === 0 || full.height === 0) {
      return;
    }
    const asPercent = ((this.keepWidth() * full.width) / full.height) * wanted;
    if (asPercent > 100) {
      this.keepWidth.set(Math.round((100 * full.height) / (full.width * wanted)));
      this.keepHeight.set(100);
      return;
    }
    this.keepHeight.set(Math.max(1, Math.round(asPercent)));
  }

  resetCut(): void {
    this.shape.set('FREE');
    this.keepWidth.set(100);
    this.keepHeight.set(100);
    this.slideX.set(50);
    this.slideY.set(50);
  }

  /** Giu nguyen anh goc, khong xoay khong cat, roi sang buc tiep theo. */
  keepAsIs(): void {
    const file = this.data.files[this.at()];
    if (file) {
      this.kept.push(file);
    }
    this.nextOne();
  }

  /**
   * Nhan lay ban da sua roi sang buc tiep theo.
   *
   * Khong xoay va khong cat gi thi tep goc duoc giu nguyen, khong ghi lai,
   * de anh khong mat net chi vi da di qua hop nay.
   */
  async useThis(): Promise<void> {
    const file = this.data.files[this.at()];
    const bitmap = this.bitmap;
    if (!file || !bitmap) {
      this.nextOne();
      return;
    }
    const untouched =
      this.turn() === 0 && this.keepWidth() === 100 && this.keepHeight() === 100;
    if (untouched) {
      this.keepAsIs();
      return;
    }
    this.working.set(true);
    try {
      this.kept.push(await cutOut(file, bitmap, this.turn(), this.box()));
    } catch {
      this.kept.push(file);
    }
    this.working.set(false);
    this.nextOne();
  }

  private nextOne(): void {
    this.bitmap?.close();
    this.bitmap = null;
    this.resetCut();
    this.turn.set(0);
    if (this.at() + 1 >= this.total) {
      this.ref.close(this.kept);
      return;
    }
    this.at.set(this.at() + 1);
    this.load();
  }

  cancel(): void {
    this.bitmap?.close();
    this.ref.close();
  }
}
