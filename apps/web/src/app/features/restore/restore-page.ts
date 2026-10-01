import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { Pet, PetPhoto, RestoreOperation } from '../../core/models/api.model';
import { PetsService } from '../../core/services/pets.service';
import { PhotosService } from '../../core/services/photos.service';
import { Icon } from '../../shared/icon/icon';
import { CompareDialog, CompareInput, CompareResult } from './compare-dialog';

/** What is applied to every picture sent here. */
const OPERATIONS: RestoreOperation[] = ['UPSCALE', 'SHARPEN', 'DENOISE', 'EXPOSURE'];

/** The largest file worth sending, matching what the server will accept. */
const SIZE_MAX_MB = 25;

const ACCEPTED = ['image/png', 'image/jpeg'];

@Component({
  selector: 'pm-restore-page',
  standalone: true,
  imports: [TranslatePipe, Icon],
  templateUrl: './restore-page.html',
  styleUrl: './restore-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestorePage implements OnInit {
  private readonly photos = inject(PhotosService);
  private readonly pets = inject(PetsService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly working = signal(false);
  readonly error = signal<string | null>(null);
  readonly done = signal<string | null>(null);

  /** Restored pictures not yet attached to any pet. */
  readonly loose = signal<PetPhoto[]>([]);
  readonly petList = signal<Pet[]>([]);

  /** True while a file is being dragged over the drop area. */
  readonly hovering = signal(false);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    forkJoin({ loose: this.photos.listLoose(), pets: this.pets.list() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ loose, pets }) => {
          this.loose.set(loose.filter((p) => p.isRestored));
          this.petList.set(pets);
        },
        error: () => this.error.set('RESTORE.LOAD_FAILED'),
      });
  }

  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.send(file);
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
      this.send(file);
    }
  }

  /** Opens the comparison for a picture restored on an earlier visit. */
  reopen(photo: PetPhoto): void {
    this.show(photo, photo);
  }

  private send(file: File): void {
    if (!ACCEPTED.includes(file.type)) {
      this.error.set('RESTORE.WRONG_TYPE');
      return;
    }
    if (file.size > SIZE_MAX_MB * 1024 * 1024) {
      this.error.set('RESTORE.TOO_BIG');
      return;
    }
    this.working.set(true);
    this.error.set(null);
    this.done.set(null);

    this.photos
      .restoreFresh(file, OPERATIONS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pair) => {
          this.working.set(false);
          this.reload();
          this.show(pair.original, pair.restored);
        },
        error: () => {
          this.working.set(false);
          this.error.set('RESTORE.FAILED');
        },
      });
  }

  /** Fetches both pictures through the checked path, then opens the comparison. */
  private show(original: PetPhoto, restored: PetPhoto): void {
    forkJoin({
      before: this.photos.content(original.originalPhoto ?? original._id),
      after: this.photos.content(restored._id),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ before, after }) => {
          const beforeUrl = URL.createObjectURL(before);
          const afterUrl = URL.createObjectURL(after);
          const input: CompareInput = {
            original,
            restored,
            beforeUrl,
            afterUrl,
            pets: this.petList(),
          };
          this.dialog
            .open<CompareDialog, CompareInput, CompareResult>(CompareDialog, {
              data: input,
              width: 'min(900px, 96vw)',
              maxHeight: '94vh',
              panelClass: 'pm-dialog',
            })
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((result) => {
              // Tra lai bo nho cua hai dia chi tam, neu khong thi moi lan mo
              // lai giu them mot ban anh trong bo nho cho toi khi tai lai trang.
              URL.revokeObjectURL(beforeUrl);
              this.answer(result, restored, afterUrl);
            });
        },
        error: () => this.error.set('RESTORE.LOAD_FAILED'),
      });
  }

  private answer(
    result: CompareResult | undefined,
    restored: PetPhoto,
    afterUrl: string,
  ): void {
    URL.revokeObjectURL(afterUrl);
    if (result?.action === 'ATTACH') {
      this.join(restored._id, result.pet);
    }
  }

  private join(photoId: string, petId: string): void {
    this.photos
      .attach(photoId, petId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.done.set('RESTORE.ATTACHED');
          this.reload();
        },
        error: () => this.error.set('RESTORE.ATTACH_FAILED'),
      });
  }
}
