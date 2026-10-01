import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PhotoRestoreService } from '../../core/services/photo-restore.service';
import { Icon } from '../../shared/icon/icon';

/** Tep lon nhat duoc gui, khop voi gioi han phia may chu. */
const SIZE_MAX_MB = 25;

const ACCEPTED = ['image/png', 'image/jpeg'];

/** Kich thuoc that cua mot tam anh, doc khi anh tai xong. */
interface Size {
  width: number;
  height: number;
}

/**
 * Phuc hoi anh, mot cong cu dung rieng.
 *
 * Nguoi dung chon mot tam anh, xem truoc, bam phuc hoi, so sanh truoc sau roi
 * tai ban moi ve may. Khong co buoc nao cham toi ho so hay album thu cung.
 */
@Component({
  selector: 'pm-restore-page',
  standalone: true,
  imports: [TranslatePipe, Icon],
  templateUrl: './restore-page.html',
  styleUrl: './restore-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestorePage {
  private readonly restorer = inject(PhotoRestoreService);
  private readonly destroyRef = inject(DestroyRef);

  readonly chosen = signal<File | null>(null);
  readonly beforeUrl = signal<string | null>(null);
  readonly afterUrl = signal<string | null>(null);
  readonly resemblance = signal<number | null>(null);
  readonly working = signal(false);
  readonly error = signal<string | null>(null);
  readonly hovering = signal(false);

  /** Vi tri duong chia giua anh goc va ban phuc hoi, tinh theo phan tram. */
  readonly split = signal(50);

  readonly sizeBefore = signal<Size | null>(null);
  readonly sizeAfter = signal<Size | null>(null);

  /** Ten tep tai ve, giu ten goc va them hau to. */
  readonly downloadName = computed(() => {
    const name = this.chosen()?.name ?? 'petmory';
    return `${name.replace(/\.[^.]+$/, '')}-phuc-hoi.png`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.dropUrls());
  }

  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.take(file);
    }
  }

  dragOver(event: DragEvent): void {
    event.preventDefault();
    this.hovering.set(true);
  }

  dragOut(): void {
    this.hovering.set(false);
  }

  drop(event: DragEvent): void {
    event.preventDefault();
    this.hovering.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.take(file);
    }
  }

  /** Bo anh dang chon de quay ve buoc dau. */
  clear(): void {
    this.dropUrls();
    this.chosen.set(null);
    this.error.set(null);
  }

  run(): void {
    const file = this.chosen();
    if (!file || this.working()) {
      return;
    }
    this.working.set(true);
    this.error.set(null);
    this.restorer
      .restore(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ picture, resemblance }) => {
          this.working.set(false);
          this.afterUrl.set(URL.createObjectURL(picture));
          this.resemblance.set(resemblance);
          this.split.set(50);
        },
        error: (problem: HttpErrorResponse) => {
          this.working.set(false);
          this.error.set(problem.status === 429 ? 'RESTORE.QUOTA' : 'RESTORE.FAILED');
        },
      });
  }

  setSplit(event: Event): void {
    this.split.set(Number((event.target as HTMLInputElement).value));
  }

  readBefore(event: Event): void {
    this.sizeBefore.set(this.sizeOf(event));
  }

  readAfter(event: Event): void {
    this.sizeAfter.set(this.sizeOf(event));
  }

  private take(file: File): void {
    if (!ACCEPTED.includes(file.type)) {
      this.error.set('RESTORE.WRONG_TYPE');
      return;
    }
    if (file.size > SIZE_MAX_MB * 1024 * 1024) {
      this.error.set('RESTORE.TOO_BIG');
      return;
    }
    this.dropUrls();
    this.error.set(null);
    this.chosen.set(file);
    this.beforeUrl.set(URL.createObjectURL(file));
  }

  private sizeOf(event: Event): Size {
    const img = event.target as HTMLImageElement;
    return { width: img.naturalWidth, height: img.naturalHeight };
  }

  /** Tra lai bo nho cua cac dia chi tam truoc khi thay anh khac. */
  private dropUrls(): void {
    for (const url of [this.beforeUrl(), this.afterUrl()]) {
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
    this.beforeUrl.set(null);
    this.afterUrl.set(null);
    this.resemblance.set(null);
    this.sizeBefore.set(null);
    this.sizeAfter.set(null);
  }
}
