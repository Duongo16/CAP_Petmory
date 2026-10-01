import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { PetsService } from '../../core/services/pets.service';
import { PhotosService } from '../../core/services/photos.service';
import { MemoriesService } from '../../core/services/memories.service';
import { DiaryPage, Pet, PetPhoto } from '../../core/models/api.model';
import { genderKeyOf, kindKeyOf } from '../../shared/pet-labels';
import { Icon } from '../../shared/icon/icon';
import { PetFace } from '../../shared/pet-face/pet-face';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

const MONTHS_IN_YEAR = 12;
const DAY_MS = 86_400_000;

/** Whole months between a date and today, never below zero. */
function monthsSince(from: string | null): number | null {
  if (!from) {
    return null;
  }
  const at = new Date(from);
  const now = new Date();
  const months =
    (now.getFullYear() - at.getFullYear()) * MONTHS_IN_YEAR + (now.getMonth() - at.getMonth());
  return Math.max(0, now.getDate() < at.getDate() ? months - 1 : months);
}

/** Whole days between a date and today, never below zero. */
function daysSince(from: string | null): number | null {
  if (!from) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / DAY_MS));
}

/** The popup closes with this when it sent the reader to another screen. */
export const LEFT = 'LEFT';

/** What the pets screen hands the detail popup. */
export interface PetDetailRequest {
  petId: string;
}

/**
 * The whole of one pet's record, opened over the pets screen: who they are,
 * what they are like, who looks after them, and how much has been kept.
 */
@Component({
  selector: 'pm-pet-detail-dialog',
  standalone: true,
  imports: [PetFace, DatePipe, TranslatePipe, Icon],
  templateUrl: './pet-detail-dialog.html',
  styleUrl: './pet-detail-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetDetailDialog implements OnInit {
  private readonly data = inject<PetDetailRequest>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PetDetailDialog>);
  private readonly router = inject(Router);
  private readonly pets = inject(PetsService);
  private readonly photos = inject(PhotosService);
  private readonly memories = inject(MemoriesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly pet = signal<Pet | null>(null);
  readonly photoCount = signal(0);
  readonly memoryCount = signal(0);
  readonly milestoneCount = signal(0);

  readonly kindKey = computed(() => {
    const one = this.pet();
    return one ? kindKeyOf(one.kind) : '';
  });

  readonly genderKey = computed(() => {
    const one = this.pet();
    return one ? genderKeyOf(one.gender) : '';
  });

  /** How old the pet is, in whole months, or nothing when no birthday is known. */
  readonly ageMonths = computed(() => monthsSince(this.pet()?.birthDate ?? null));

  /** How long the pet has been home, counted from the day it arrived. */
  readonly daysTogether = computed(() =>
    daysSince(this.pet()?.adoptionDate ?? this.pet()?.birthDate ?? null),
  );

  ngOnInit(): void {
    this.load(this.data.petId);
  }

  close(): void {
    this.ref.close();
  }


  /** Leaves the popup for another screen, so the popup does not linger over it. */
  go(path: string[], queryParams?: Record<string, string>): void {
    this.ref.close(LEFT);
    void this.router.navigate(path, { queryParams });
  }

  openBook(): void {
    this.go(['/journals'], { open: this.data.petId });
  }

  openAlbum(): void {
    this.go(['/pets', this.data.petId, 'photos']);
  }

  private load(id: string): void {
    this.status.set('LOADING');
    forkJoin({
      pet: this.pets.byId(id),
      photos: this.photos.list(id).pipe(catchError(() => of<PetPhoto[]>([]))),
      diary: this.memories.forPet(id).pipe(
        catchError(() =>
          of<DiaryPage>({
            rows: [],
            total: 0,
            page: 1,
            pageCount: 1,
            countByTopic: {},
            milestoneCount: 0,
          }),
        ),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (all) => {
          this.pet.set(all.pet);
          const kept = all.photos.filter((one) => !one.isRestored);
          this.photoCount.set(kept.length);
          this.memoryCount.set(all.diary.total);
          this.milestoneCount.set(all.diary.milestoneCount);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });
  }
}
