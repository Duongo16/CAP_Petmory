import { ChangeDetectionStrategy, Component, computed, input, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Viewer3d } from '../../shared/viewer-3d/viewer-3d';
import { AccessoryMount } from '../../shared/viewer-3d/engine-3d';
import { MeshPaint } from '../../core/models/api.model';

/** Chieu cao mac dinh khi bang thong so khong ghi so cm nao. */
const HEIGHT_DEFAULT_CM = 10;

/** Lay so cm dau tien trong dong kich thuoc, vi du "Cao khoang 8 cm" ra 8. */
function heightOf(dimensions: string | undefined): number {
  const found = /(\d+(?:[.,]\d+)?)/.exec(dimensions ?? '');
  const value = found ? Number(found[1].replace(',', '.')) : NaN;
  return Number.isFinite(value) && value > 0 ? value : HEIGHT_DEFAULT_CM;
}

/**
 * Mo hinh 3D co chuc nang do kich thuoc cho xuong (muc 11).
 *
 * Dung lai dung mo hinh khach da duyet (kem mau to). Xuong nhap chieu cao
 * that cua thanh pham, man hinh quy ra chieu ngang, chieu sau, va do duoc
 * khoang cach giua hai diem bat ky tren be theo cm.
 */
@Component({
  selector: 'pm-production-model-card',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, Viewer3d],
  templateUrl: './production-model-card.html',
  styleUrl: './production-model-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionModelCard {
  /** Tep khach da to (ban nhe): mau to luu theo tung mat cua dung tep nay. */
  readonly file = input.required<string>();
  /** Ban day du cho xuong tai ve; ty le kich thuoc nhu ban nhe. */
  readonly fullFile = input<string>('');
  readonly paint = input<MeshPaint[]>([]);
  readonly accessories = input<AccessoryMount[]>([]);
  readonly dimensions = input<string>('');

  private readonly viewer = viewChild(Viewer3d);

  readonly heightCm = signal<number | null>(null);
  readonly size = signal<{ x: number; y: number; z: number } | null>(null);
  readonly measuring = signal(false);
  readonly lastDistance = signal<number | null>(null);

  readonly path = computed(() => `/models/${this.file()}`);
  readonly fullPath = computed(() => (this.fullFile() ? `/models/${this.fullFile()}` : ''));
  readonly height = computed(() => this.heightCm() ?? heightOf(this.dimensions()));
  /** So cm tren mot don vi trong canh, tu chieu cao that xuong nhap. */
  readonly scale = computed(() => {
    const box = this.size();
    return box && box.y > 0 ? this.height() / box.y : 0;
  });
  readonly sizeCm = computed(() => {
    const box = this.size();
    const ratio = this.scale();
    return box ? { width: box.x * ratio, depth: box.z * ratio, height: box.y * ratio } : null;
  });
  readonly distanceCm = computed(() => {
    const raw = this.lastDistance();
    return raw === null ? null : raw * this.scale();
  });

  ready(): void {
    this.size.set(this.viewer()?.modelSize() ?? null);
  }

  setHeight(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value.replace(',', '.'));
    this.heightCm.set(Number.isFinite(value) && value > 0 ? value : null);
  }

  toggleMeasure(): void {
    this.measuring.update((on) => !on);
    this.lastDistance.set(null);
    this.viewer()?.clearMeasure();
  }

  onMeasured(distance: number): void {
    this.lastDistance.set(distance);
  }
}
