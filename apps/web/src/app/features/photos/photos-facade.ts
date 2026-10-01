import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';
import { PetPhoto, PhotoRules, QualityLabel } from '../../core/models/api.model';
import { PetsService } from '../../core/services/pets.service';
import { PhotosService } from '../../core/services/photos.service';

type ScreenState = 'LOADING' | 'ERROR' | 'EMPTY' | 'HAS_DATA';

/**
 * How each verdict reads and which colour it takes. Every key is written out
 * in full so it stays searchable, and keys are never built by joining strings.
 */
const QUALITY_KEY: Record<QualityLabel, string> = {
  GOOD: 'PHOTO.GRADE.GOOD',
  ACCEPTABLE: 'PHOTO.GRADE.ACCEPTABLE',
  SHOULD_RESTORE: 'PHOTO.GRADE.SHOULD_RESTORE',
  UNUSABLE: 'PHOTO.GRADE.UNUSABLE',
};

const QUALITY_TONE: Record<QualityLabel, string> = {
  GOOD: 'good',
  ACCEPTABLE: 'fair',
  SHOULD_RESTORE: 'weak',
  UNUSABLE: 'bad',
};

/** What each finding from the check means, in words a customer can act on. */
const WARNING_KEY: Record<string, string> = {
  RESOLUTION_TOO_LOW: 'PHOTO.WARN.RESOLUTION_TOO_LOW',
  RESOLUTION_LOW: 'PHOTO.WARN.RESOLUTION_LOW',
  TOO_BLURRY: 'PHOTO.WARN.TOO_BLURRY',
  SLIGHTLY_BLURRY: 'PHOTO.WARN.SLIGHTLY_BLURRY',
  UNDEREXPOSED: 'PHOTO.WARN.UNDEREXPOSED',
  OVEREXPOSED: 'PHOTO.WARN.OVEREXPOSED',
};

const WARNING_KEY_OTHER = 'PHOTO.WARN.OTHER';

/** Verdicts that mean the picture is ready to work from. */
const READY_LABELS: QualityLabel[] = ['GOOD', 'ACCEPTABLE'];

/** One picture ready to show, with a viewable address and its restored version. */
export interface PhotoTile {
  photo: PetPhoto;
  source: string;
  restored: PetPhoto | null;
  restoredSource: string;
  /** How the check read this picture, ready for the view. */
  gradeKey: string;
  gradeTone: string;
  findingKeys: string[];
  wantsRestoring: boolean;
}

const ACCEPTED = ['image/png', 'image/jpeg'];
const PHOTO_MAX = 20;

/**
 * Holds the album of one pet.
 *
 * It used to lay out six fixed slots and ask the customer to fill each named
 * angle. That was the wrong shape for what people do, which is send the
 * photographs they already love, so this is simply an album now.
 */
@Injectable()
export class PhotosFacade {
  private readonly service = inject(PhotosService);
  private readonly pets = inject(PetsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly error = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly petName = signal('');

  /** Gioi han kich thuoc anh, de hop sua anh canh bao dung nguong. */
  readonly rules = signal<PhotoRules | null>(null);

  private readonly rows = signal<PetPhoto[]>([]);

  /** Addresses of the fetched bytes, keyed by picture. */
  private readonly source = signal<Record<string, string>>({});

  private petId = '';

  private readonly cleanup = this.destroyRef.onDestroy(() => this.releaseSource());

  /** The originals, each carrying its restored version when there is one. */
  readonly tiles = computed<PhotoTile[]>(() => {
    const all = this.rows();
    const seen = this.source();
    const restored = all.filter((p) => p.isRestored);
    return all
      .filter((p) => !p.isRestored)
      .map((photo) => {
        const version = restored.find((r) => r.originalPhoto === photo._id) ?? null;
        const label = photo.quality.label;
        return {
          photo,
          source: seen[photo._id] ?? '',
          restored: version,
          restoredSource: version ? (seen[version._id] ?? '') : '',
          gradeKey: QUALITY_KEY[label],
          gradeTone: QUALITY_TONE[label],
          findingKeys: photo.quality.warning.map((one) => WARNING_KEY[one] ?? WARNING_KEY_OTHER),
          wantsRestoring: !READY_LABELS.includes(label) && version === null,
        };
      });
  });

  readonly count = computed(() => this.tiles().length);
  readonly full = computed(() => this.count() >= PHOTO_MAX);
  readonly limit = PHOTO_MAX;

  /** How many pictures the workshop can already work from. */
  readonly readyCount = computed(
    () => this.tiles().filter((t) => READY_LABELS.includes(t.photo.quality.label)).length,
  );

  /** How many would be better for a pass through restoration first. */
  readonly weakCount = computed(() => this.tiles().filter((t) => t.wantsRestoring).length);

  /** The share of the album the workshop can use, as a whole percentage. */
  readonly readyShare = computed(() => {
    const all = this.count();
    return all === 0 ? 0 : Math.round((this.readyCount() / all) * 100);
  });

  start(petId: string): void {
    this.petId = petId;
    this.service
      .rules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (limit) => this.rules.set(limit),
        error: () => undefined,
      });
    this.pets
      .byId(petId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pet) => this.petName.set(pet.name),
        error: () => undefined,
      });
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
          this.status.set(rows.length === 0 ? 'EMPTY' : 'HAS_DATA');
          this.fetchSources(rows);
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /** Sends every chosen picture, then reloads once they have all landed. */
  add(files: File[]): void {
    const wrong = files.filter((f) => !ACCEPTED.includes(f.type));
    if (wrong.length > 0) {
      this.error.set('PET.PHOTO_WRONG_TYPE');
      return;
    }
    if (this.count() + files.length > PHOTO_MAX) {
      this.error.set('PHOTO.TOO_MANY');
      return;
    }
    this.uploading.set(true);
    this.error.set(null);
    forkJoin(files.map((file) => this.service.loadGeneral(this.petId, file)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.uploading.set(false);
          this.reload();
        },
        error: () => {
          this.uploading.set(false);
          this.error.set('COMMON.GENERIC_ERROR');
        },
      });
  }

  /** Nho may chu tai buc anh o duong dan tren mang ve va them vao album. */
  addLink(url: string): void {
    if (this.full()) {
      this.error.set('PHOTO.TOO_MANY');
      return;
    }
    this.uploading.set(true);
    this.error.set(null);
    this.service
      .loadByLink(this.petId, url)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.uploading.set(false);
          this.reload();
        },
        error: () => {
          this.uploading.set(false);
          this.error.set('PHOTO.LINK_FAILED');
        },
      });
  }

  remove(photo: PetPhoto): void {
    this.service
      .hide(photo._id)
      .pipe(
        switchMap(() => {
          // Ban phuc hoi gan voi anh nay cung phai bien mat cung no.
          const version = this.rows().find((r) => r.originalPhoto === photo._id);
          return version ? this.service.hide(version._id) : of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.reload(),
        error: () => this.error.set('COMMON.GENERIC_ERROR'),
      });
  }

  /** Fetches the bytes of every picture through the permission-checked path. */
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

  /** Hands back the memory held by the temporary addresses. */
  private releaseSource(): void {
    for (const address of Object.values(this.source())) {
      URL.revokeObjectURL(address);
    }
  }
}
