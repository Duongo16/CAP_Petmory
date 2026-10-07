import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PhotoRestoreService, RestoreOperation, RestoreQuota } from '../../core/services/photo-restore.service';
import { PetsService } from '../../core/services/pets.service';
import { PhotosService } from '../../core/services/photos.service';
import { Pet } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';
import { looksLikeImage, PICK_MAX_BYTES } from '../../core/utils/upload-image';

/** Tep lon nhat duoc gui, khop voi gioi han phia may chu. */


/** Cac thao tac khach chon duoc; hai thao tac cuoi dung mo hinh sua anh (muc 4). */
const OPERATION_LIST: { code: RestoreOperation; key: string; ai: boolean }[] = [
  { code: 'UPSCALE', key: 'RESTORE.OP.UPSCALE', ai: false },
  { code: 'SHARPEN', key: 'RESTORE.OP.SHARPEN', ai: false },
  { code: 'DENOISE', key: 'RESTORE.OP.DENOISE', ai: false },
  { code: 'EXPOSURE', key: 'RESTORE.OP.EXPOSURE', ai: false },
  { code: 'CONTRAST', key: 'RESTORE.OP.CONTRAST', ai: false },
  { code: 'FACE_DETAIL', key: 'RESTORE.OP.FACE_DETAIL', ai: true },
  { code: 'REMOVE_BACKGROUND', key: 'RESTORE.OP.REMOVE_BACKGROUND', ai: true },
];

const OPERATION_DEFAULT: RestoreOperation[] = ['UPSCALE', 'SHARPEN', 'DENOISE', 'EXPOSURE'];

/** Kich thuoc that cua mot tam anh, doc khi anh tai xong. */
interface Size {
  width: number;
  height: number;
}

/**
 * Phuc hoi anh, mot cong cu dung rieng.
 *
 * Nguoi dung chon mot tam anh va cac thao tac, bam phuc hoi, so sanh truoc sau,
 * roi xac nhan bang cach luu vao album cua be hoac tai ban moi ve may.
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
  private readonly petsService = inject(PetsService);
  private readonly photos = inject(PhotosService);

  /** Thao tac dang chon; mac dinh bon bo loc tai may. */
  readonly operations = signal<RestoreOperation[]>([...OPERATION_DEFAULT]);
  readonly operationCards = computed(() =>
    OPERATION_LIST.map((one) => ({ ...one, on: this.operations().includes(one.code) })),
  );
  /** Ket qua da dung AI that hay chi bo loc, va thao tac AI nao khong lam duoc. */
  readonly mode = signal<'LIVE' | 'LOCAL' | null>(null);
  readonly skipped = signal<string[]>([]);
  readonly pets = signal<Pet[]>([]);
  readonly petChosen = signal('');
  readonly saveState = signal<'IDLE' | 'SAVING' | 'SAVED' | 'FAILED'>('IDLE');
  private afterBlob: Blob | null = null;
  private readonly destroyRef = inject(DestroyRef);

  readonly chosen = signal<File | null>(null);
  readonly beforeUrl = signal<string | null>(null);
  readonly afterUrl = signal<string | null>(null);
  readonly resemblance = signal<number | null>(null);
  readonly working = signal(false);

  /** So luot phuc hoi con lai do Quan ly dat; null khi chua doc duoc. */
  readonly quota = signal<RestoreQuota | null>(null);

  /** Da het luot thi khoa nut phuc hoi, de khach khong bam roi moi biet. */
  readonly outOfTurns = computed(() => this.quota()?.left === 0);
  readonly error = signal<string | null>(null);
  readonly hovering = signal(false);

  /** Vi tri duong chia giua anh goc va ban phuc hoi, tinh theo phan tram. */
  readonly split = signal(50);

  readonly sizeBefore = signal<Size | null>(null);
  readonly sizeAfter = signal<Size | null>(null);

  /** Ten tep tai ve, giu ten goc va them hau to. */
  readonly downloadName = computed(() => {
    const name = this.chosen()?.name ?? 'petmory';
    // May chu tra JPEG khi anh phuc hoi qua nang, nen duoi tep theo dung loai nhan duoc.
    const ending = this.afterType() === 'image/jpeg' ? 'jpg' : 'png';
    return `${name.replace(/\.[^.]+$/, '')}-phuc-hoi.${ending}`;
  });

  /** Loai anh cua ban phuc hoi vua nhan. */
  private readonly afterType = signal('image/png');

  constructor() {
    this.destroyRef.onDestroy(() => this.dropUrls());
    this.readQuota();
    this.petsService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.pets.set(rows);
          this.petChosen.set(rows[0]?._id ?? '');
        },
        error: () => this.pets.set([]),
      });
  }

  toggleOperation(code: RestoreOperation): void {
    const now = this.operations();
    this.operations.set(now.includes(code) ? now.filter((one) => one !== code) : [...now, code]);
  }

  choosePet(event: Event): void {
    this.petChosen.set((event.target as HTMLSelectElement).value);
  }

  /** Khach xac nhan ban phuc hoi thi luu vao album cua be; khong luu thi chi tai ve. */
  saveToPet(): void {
    const pet = this.petChosen();
    if (!pet || !this.afterBlob || this.saveState() === 'SAVING') {
      return;
    }
    this.saveState.set('SAVING');
    const file = new File([this.afterBlob], this.downloadName(), { type: this.afterBlob.type || 'image/png' });
    this.photos
      .loadGeneral(pet, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.saveState.set('SAVED'),
        error: () => this.saveState.set('FAILED'),
      });
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
    if (this.operations().length === 0) {
      this.error.set('RESTORE.PICK_ONE');
      return;
    }
    this.working.set(true);
    this.error.set(null);
    this.saveState.set('IDLE');
    this.restorer
      .restore(file, this.operations())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ picture, resemblance, mode, skipped }) => {
          this.working.set(false);
          this.afterBlob = picture;
          this.afterType.set(picture.type || 'image/png');
          this.afterUrl.set(URL.createObjectURL(picture));
          this.resemblance.set(resemblance);
          this.mode.set(mode);
          this.skipped.set(skipped);
          this.split.set(50);
          this.readQuota();
        },
        error: (problem: HttpErrorResponse) => {
          this.working.set(false);
          this.error.set(problem.status === 429 ? 'RESTORE.QUOTA' : 'RESTORE.FAILED');
          this.readQuota();
        },
      });
  }

  private readQuota(): void {
    this.restorer
      .quota()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (got) => this.quota.set(got),
        error: () => this.quota.set(null),
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
    if (!looksLikeImage(file)) {
      this.error.set('RESTORE.WRONG_TYPE');
      return;
    }
    if (file.size > PICK_MAX_BYTES) {
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
    this.afterBlob = null;
    this.mode.set(null);
    this.skipped.set([]);
    this.saveState.set('IDLE');
    this.resemblance.set(null);
    this.sizeBefore.set(null);
    this.sizeAfter.set(null);
  }
}
