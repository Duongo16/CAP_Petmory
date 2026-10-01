import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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

/**
 * The whole of one pet's record: who they are, what they are like, who looks
 * after them, and how much of their story has been kept.
 */
@Component({
  selector: 'pm-pet-profile-page',
  standalone: true,
  imports: [RouterLink, DatePipe, TranslatePipe, Icon],
  templateUrl: './pet-profile-page.html',
  styleUrl: './pet-profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetProfilePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
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
    this.load(this.route.snapshot.paramMap.get('id') ?? '');
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
          this.photoCount.set(all.photos.filter((one) => !one.isRestored).length);
          this.memoryCount.set(all.diary.total);
          this.milestoneCount.set(all.diary.milestoneCount);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });
  }
}
