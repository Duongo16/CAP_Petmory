import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ANGLE_REQUIRED,
  ANGLE_ADD,
  PhotosService,
} from '../../core/services/photos.service';
import {
  PetPhoto,
  PhotoAngle,
  QualityLabel,
  RestoreOperation,
} from '../../core/models/api.model';

export type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/**
 * Translation key lookup. Declared explicitly so every key can be found in the
 * source. Keys are never built by joining strings.
 */
const KEY_ANGLE: Record<PhotoAngle, string> = {
  FRONT: 'PHOTO.ANGLE.FRONT',
  LEFT_SIDE: 'PHOTO.ANGLE.LEFT_SIDE',
  RIGHT_SIDE: 'PHOTO.ANGLE.RIGHT_SIDE',
  BACK: 'PHOTO.ANGLE.BACK',
  FACE_CLOSEUP: 'PHOTO.ANGLE.FACE_CLOSEUP',
  FAVOURITE_POSE: 'PHOTO.ANGLE.FAVOURITE_POSE',
};

const KEY_LABEL: Record<QualityLabel, string> = {
  GOOD: 'PHOTO.LABEL.GOOD',
  ACCEPTABLE: 'PHOTO.LABEL.ACCEPTABLE',
  SHOULD_RESTORE: 'PHOTO.LABEL.SHOULD_RESTORE',
  UNUSABLE: 'PHOTO.LABEL.UNUSABLE',
};

const KEY_WARNING: Record<string, string> = {
  RESOLUTION_TOO_LOW: 'PHOTO.WARNING.RESOLUTION_TOO_LOW',
  RESOLUTION_LOW: 'PHOTO.WARNING.RESOLUTION_LOW',
  TOO_BLURRY: 'PHOTO.WARNING.TOO_BLURRY',
  SLIGHTLY_BLURRY: 'PHOTO.WARNING.SLIGHTLY_BLURRY',
  UNDEREXPOSED: 'PHOTO.WARNING.UNDEREXPOSED',
  OVEREXPOSED: 'PHOTO.WARNING.OVEREXPOSED',
};

const KEY_WARNING_OTHER = 'PHOTO.WARNING.OTHER';

/** One photo carrying everything the view needs, so nothing is recomputed there. */
export interface PhotoView {
  raw: PetPhoto;
  keyLabel: string;
  warningKeys: string[];
  shouldRestore: boolean;
  /** True when a restored version no longer resembles the original closely enough. */
  resemblanceLow: boolean;
}

/** One upload slot for a camera angle, with its restored version if there is one. */
export interface AngleSlot {
  angle: PhotoAngle;
  keyAngle: string;
  slotId: string;
  required: boolean;
  photo: PhotoView | null;
  versionRestore: PhotoView | null;
}

/**
 * Below this the customer is warned that the restoration may have moved the
 * pet's features. The server decides with the Manager's own figure. This is only
 * the fallback used until the settings have been read.
 */
const RESEMBLANCE_FALLBACK = 90;

/** The one message every failed call on this screen falls back to. */
const KEY_GENERIC_ERROR = 'COMMON.GENERIC_ERROR';

function wrap(photo: PetPhoto | null, minResemblance = RESEMBLANCE_FALLBACK): PhotoView | null {
  if (!photo) {
    return null;
  }
  return {
    raw: photo,
    keyLabel: KEY_LABEL[photo.quality.label],
    warningKeys: photo.quality.warning.map((c) => KEY_WARNING[c] ?? KEY_WARNING_OTHER),
    shouldRestore: photo.quality.label !== 'GOOD',
    resemblanceLow: photo.resemblance !== null && photo.resemblance < minResemblance,
  };
}

/**
 * Holds all state and server calls for the pet photos screen.
 * The component only reads signals and issues commands, keeping no state itself.
 */
@Injectable()
export class PhotosFacade {
  private readonly service = inject(PhotosService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly list = signal<PetPhoto[]>([]);

  /** Temporary URL for showing the image in the browser, made from the fetched bytes. */
  readonly sourcePhoto = signal<Record<string, string>>({});

  readonly status = signal<ScreenState>('LOADING');
  readonly error = signal<string | null>(null);
  readonly uploading = signal<PhotoAngle | null>(null);
  readonly pendingRestore = signal<string | null>(null);

  /** The photo whose before/after comparison is currently open. */
  readonly pendingCompare = signal<string | null>(null);

  private petId = '';

  private readonly cleanup = this.destroyRef.onDestroy(() => this.releaseSource());

  readonly tiles = computed<AngleSlot[]>(() => {
    const ds = this.list();
    const angle = ds.filter((a) => !a.isRestored);
    const restore = ds.filter((a) => a.isRestored);
    const allAngle: PhotoAngle[] = [...ANGLE_REQUIRED, ...ANGLE_ADD];
    return allAngle.map((g) => {
      const photo = angle.find((a) => a.angle === g) ?? null;
      const version = photo ? (restore.find((p) => p.originalPhoto === photo._id) ?? null) : null;
      return {
        angle: g,
        keyAngle: KEY_ANGLE[g],
        slotId: `file-${g}`,
        required: ANGLE_REQUIRED.includes(g),
        photo: wrap(photo),
        versionRestore: wrap(version),
      };
    });
  });

  readonly anglesFilled = computed(
    () => this.tiles().filter((o) => o.required && o.photo !== null).length,
  );
  readonly requiredAngleCount = ANGLE_REQUIRED.length;
  readonly rawAngle = computed(() => this.anglesFilled() === this.requiredAngleCount);

  start(petId: string): void {
    this.petId = petId;
    this.reload();
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .list(this.petId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ds) => {
          this.list.set(ds);
          this.status.set('READY');
          ds.forEach((a) => this.loadSource(a._id));
        },
        error: () => this.status.set('ERROR'),
      });
  }

  load(angle: PhotoAngle, file: File): void {
    this.error.set(null);
    this.uploading.set(angle);
    this.service
      .load(this.petId, angle, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (next) => {
          this.uploading.set(null);
          this.list.update((ds) => [...ds.filter((a) => a._id !== next._id), next]);
          this.loadSource(next._id);
        },
        error: (e: { status?: number }) => {
          this.uploading.set(null);
          this.error.set(e.status === 400 ? 'PHOTO.ERROR_FILE' : KEY_GENERIC_ERROR);
        },
      });
  }

  restore(codePhoto: string, operation: RestoreOperation[]): void {
    this.error.set(null);
    this.pendingRestore.set(codePhoto);
    this.service
      .restore(codePhoto, operation)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (version) => {
          this.pendingRestore.set(null);
          this.list.update((ds) => [...ds.filter((a) => a.originalPhoto !== codePhoto), version]);
          this.loadSource(version._id);
          this.pendingCompare.set(codePhoto);
        },
        error: (e: { status?: number }) => {
          this.pendingRestore.set(null);
          this.error.set(e.status === 429 ? 'PHOTO.QUOTA_REACHED' : KEY_GENERIC_ERROR);
        },
      });
  }

  /** The customer decides whether to use the restored version or keep the original. */
  decide(versionRestore: PetPhoto, accept: boolean): void {
    this.service
      .confirm(versionRestore._id, accept)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (version) => {
          this.pendingCompare.set(null);
          this.list.update((ds) =>
            accept
              ? ds.map((a) => (a._id === version._id ? version : a))
              : ds.filter((a) => a._id !== version._id),
          );
        },
        error: () => this.error.set(KEY_GENERIC_ERROR),
      });
  }

  remove(photo: PetPhoto): void {
    this.service
      .hide(photo._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () =>
          this.list.update((ds) =>
            ds.filter((a) => a._id !== photo._id && a.originalPhoto !== photo._id),
          ),
        error: () => this.error.set(KEY_GENERIC_ERROR),
      });
  }

  openCompare(codePhoto: string | null): void {
    this.pendingCompare.set(codePhoto);
  }

  private loadSource(codePhoto: string): void {
    if (this.sourcePhoto()[codePhoto]) {
      return;
    }
    this.service
      .content(codePhoto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const path = URL.createObjectURL(blob);
          this.sourcePhoto.update((old) => ({ ...old, [codePhoto]: path }));
        },
        error: () => undefined,
      });
  }

  private releaseSource(): void {
    Object.values(this.sourcePhoto()).forEach((d) => URL.revokeObjectURL(d));
  }
}
