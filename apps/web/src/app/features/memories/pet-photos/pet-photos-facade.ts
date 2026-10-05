import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, of, switchMap } from 'rxjs';
import { PetPhoto, PhotoAngle, PhotoRules, QualityLabel } from '../../../core/models/api.model';
import { PhotosService } from '../../../core/services/photos.service';

type ScreenState = 'LOADING' | 'ERROR' | 'EMPTY' | 'HAS_DATA';

/** Mot tam anh san sang hien thi, kem dia chi tam doc qua duong co kiem quyen. */
export interface PhotoCard {
  photo: PetPhoto;
  source: string;
  /** Nhan chat luong may chu cham, va co can canh bao hay khong. */
  qualityKey: string;
  warn: boolean;
}

const ACCEPTED = ['image/png', 'image/jpeg'];
const PHOTO_MAX = 20;

/** Khung nap theo goc (muc 3): bon goc bat buoc va hai goc tuy chon. */
const SLOTS: { angle: PhotoAngle; required: boolean; key: string }[] = [
  { angle: 'FRONT', required: true, key: 'PHOTO.FRAME.ANGLE.FRONT' },
  { angle: 'LEFT_SIDE', required: true, key: 'PHOTO.FRAME.ANGLE.LEFT_SIDE' },
  { angle: 'RIGHT_SIDE', required: true, key: 'PHOTO.FRAME.ANGLE.RIGHT_SIDE' },
  { angle: 'BACK', required: true, key: 'PHOTO.FRAME.ANGLE.BACK' },
  { angle: 'FACE_CLOSEUP', required: false, key: 'PHOTO.FRAME.ANGLE.FACE_CLOSEUP' },
  { angle: 'FAVOURITE_POSE', required: false, key: 'PHOTO.FRAME.ANGLE.FAVOURITE_POSE' },
];

const QUALITY_KEY: Record<QualityLabel, string> = {
  GOOD: 'PHOTO.QUALITY.GOOD',
  ACCEPTABLE: 'PHOTO.QUALITY.ACCEPTABLE',
  SHOULD_RESTORE: 'PHOTO.QUALITY.SHOULD_RESTORE',
  UNUSABLE: 'PHOTO.QUALITY.UNUSABLE',
};

/** Mot o trong khung nap theo goc, kem anh dang nam o goc do neu co. */
export interface AngleSlot {
  angle: PhotoAngle;
  required: boolean;
  key: string;
  card: PhotoCard | null;
}

/**
 * Giu danh sach anh cua mot be cho tab Anh trong nhat ky.
 *
 * Chi gom anh goc ma nguoi dung da gui; nhung ban phuc hoi cu con sot lai
 * trong kho thi khong hien ra o day.
 */
@Injectable()
export class PetPhotosFacade {
  private readonly service = inject(PhotosService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly error = signal<string | null>(null);
  readonly uploading = signal(false);

  /** Gioi han kich thuoc anh, de hop sua anh canh bao dung nguong. */
  readonly rules = signal<PhotoRules | null>(null);

  private readonly rows = signal<PetPhoto[]>([]);
  private readonly source = signal<Record<string, string>>({});
  private petId = '';

  private readonly cleanup = this.destroyRef.onDestroy(() => this.releaseSource());

  readonly cards = computed<PhotoCard[]>(() => {
    const seen = this.source();
    return this.rows()
      .filter((p) => !p.isRestored)
      .map((photo) => ({
        photo,
        source: seen[photo._id] ?? '',
        qualityKey: QUALITY_KEY[photo.quality?.label] ?? QUALITY_KEY.ACCEPTABLE,
        warn: photo.quality?.label === 'SHOULD_RESTORE' || photo.quality?.label === 'UNUSABLE',
      }));
  });

  /** Sau o theo goc; o nao co nhieu anh thi lay tam moi nhat. */
  readonly slots = computed<AngleSlot[]>(() => {
    const cards = this.cards();
    return SLOTS.map((slot) => ({
      ...slot,
      card: [...cards].reverse().find((one) => one.photo.angle === slot.angle) ?? null,
    }));
  });

  /** Anh khong theo goc nao, hien o phan anh khac. */
  readonly others = computed(() => {
    const placed = new Set(this.slots().flatMap((slot) => (slot.card ? [slot.card.photo._id] : [])));
    return this.cards().filter((one) => !placed.has(one.photo._id));
  });

  readonly requiredDone = computed(() => this.slots().filter((slot) => slot.required && slot.card).length);
  readonly requiredTotal = SLOTS.filter((slot) => slot.required).length;

  readonly count = computed(() => this.cards().length);
  readonly full = computed(() => this.count() >= PHOTO_MAX);
  readonly limit = PHOTO_MAX;

  start(petId: string): void {
    this.petId = petId;
    this.service
      .rules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (limit) => this.rules.set(limit), error: () => undefined });
    this.reload();
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .list(this.petId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.status.set(rows.some((p) => !p.isRestored) ? 'HAS_DATA' : 'EMPTY');
          this.fetchSources(rows.filter((p) => !p.isRestored));
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /** Gui moi tam da chon, roi tai lai mot lan khi tat ca da len. */
  add(files: File[], done: () => void): void {
    if (files.some((f) => !ACCEPTED.includes(f.type))) {
      this.error.set('PET.PHOTO_WRONG_TYPE');
      return;
    }
    if (this.count() + files.length > PHOTO_MAX) {
      this.error.set('PHOTO.TOO_MANY');
      return;
    }
    this.send(forkJoin(files.map((file) => this.service.loadGeneral(this.petId, file))), 'COMMON.GENERIC_ERROR', done);
  }

  /**
   * Dat mot anh vao mot goc. Neu goc da co anh thi day la thay anh: tam moi len
   * truoc, roi moi bo tam cu, de khong luc nao goc bi trong.
   */
  addToAngle(angle: PhotoAngle, file: File, replacing: PetPhoto | null, done: () => void): void {
    if (!ACCEPTED.includes(file.type)) {
      this.error.set('PET.PHOTO_WRONG_TYPE');
      return;
    }
    if (!replacing && this.full()) {
      this.error.set('PHOTO.TOO_MANY');
      return;
    }
    const work = this.service
      .load(this.petId, angle, file)
      .pipe(switchMap(() => (replacing ? this.service.hide(replacing._id) : of(null))));
    this.send(work, 'COMMON.GENERIC_ERROR', done);
  }

  /** Nho may chu tai buc anh o duong dan tren mang ve va them vao danh sach. */
  addLink(url: string, done: () => void): void {
    if (this.full()) {
      this.error.set('PHOTO.TOO_MANY');
      return;
    }
    this.send(this.service.loadByLink(this.petId, url), 'PHOTO.LINK_FAILED', done);
  }

  remove(photo: PetPhoto, done: () => void): void {
    this.service
      .hide(photo._id)
      .pipe(
        switchMap(() => {
          // Ban phuc hoi cu gan voi anh nay cung phai bien mat cung no.
          const version = this.rows().find((r) => r.originalPhoto === photo._id);
          return version ? this.service.hide(version._id) : of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.reload();
          done();
        },
        error: () => this.error.set('COMMON.GENERIC_ERROR'),
      });
  }

  private send(work: Observable<unknown>, failKey: string, done: () => void): void {
    this.uploading.set(true);
    this.error.set(null);
    work.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.uploading.set(false);
        this.reload();
        done();
      },
      error: () => {
        this.uploading.set(false);
        this.error.set(failKey);
      },
    });
  }

  /** Doc noi dung tung anh qua duong co kiem quyen. */
  private fetchSources(rows: PetPhoto[]): void {
    if (rows.length === 0) {
      this.releaseSource();
      this.source.set({});
      return;
    }
    forkJoin(rows.map((row) => this.service.content(row._id)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blobs) => {
          this.releaseSource();
          const next: Record<string, string> = {};
          rows.forEach((row, i) => {
            next[row._id] = URL.createObjectURL(blobs[i]);
          });
          this.source.set(next);
        },
        error: () => this.error.set('COMMON.GENERIC_ERROR'),
      });
  }

  private releaseSource(): void {
    for (const address of Object.values(this.source())) {
      URL.revokeObjectURL(address);
    }
  }
}
