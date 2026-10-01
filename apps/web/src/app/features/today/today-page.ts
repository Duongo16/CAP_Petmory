import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { PetsService } from '../../core/services/pets.service';
import { MemoriesService } from '../../core/services/memories.service';
import { AuthService } from '../../core/services/auth.service';
import { Memory, Pet } from '../../core/models/api.model';
import { kindKeyOf } from '../../shared/pet-labels';
import { topicKey } from '../../shared/memory-topics';
import { Icon } from '../../shared/icon/icon';
import { PetArt, PetArtKind } from '../../shared/pet-art/pet-art';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

const DAY_MS = 86_400_000;
const RECENT_MAX = 3;

/** The hours at which the greeting changes. */
const NOON = 12;
const EVENING = 18;

/** How the day is addressed, written out so no key is ever built up. */
const GREETING_KEY = {
  MORNING: 'TODAY.GREET_MORNING',
  AFTERNOON: 'TODAY.GREET_AFTERNOON',
  EVENING: 'TODAY.GREET_EVENING',
};

/** Whole days between a date and today, never below zero. */
function daysSince(from: string | null): number {
  if (!from) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / DAY_MS));
}

/** How many whole years ago a date was, at least one. */
function yearsAgo(from: string): number {
  const apart = Date.now() - new Date(from).getTime();
  return Math.max(1, Math.round(apart / (DAY_MS * 365)));
}

/**
 * The day's page: who is at home, the last thing written down, and a moment
 * from an earlier year that falls near today.
 */
@Component({
  selector: 'pm-today-page',
  standalone: true,
  imports: [RouterLink, DatePipe, TranslatePipe, Icon, PetArt],
  templateUrl: './today-page.html',
  styleUrl: './today-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayPage implements OnInit {
  private readonly pets = inject(PetsService);
  private readonly memories = inject(MemoriesService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly petRows = signal<Pet[]>([]);
  readonly recent = signal<Memory[]>([]);

  readonly flashback = signal<Memory | null>(null);

  readonly today = new Date().toISOString();
  readonly whoseName = computed(() => this.auth.user()?.fullName ?? '');

  readonly greetingKey = computed(() => {
    const hour = new Date().getHours();
    if (hour < NOON) {
      return GREETING_KEY.MORNING;
    }
    return hour < EVENING ? GREETING_KEY.AFTERNOON : GREETING_KEY.EVENING;
  });

  /** The pet the page puts forward, which is simply the first one kept. */
  readonly spotlight = computed(() => this.petRows()[0] ?? null);

  readonly daysTogether = computed(() =>
    daysSince(this.spotlight()?.adoptionDate ?? this.spotlight()?.birthDate ?? null),
  );

  /** Every pet, with the label its card shows when no breed was written down. */
  readonly petCards = computed(() =>
    this.petRows().map((pet) => ({
      pet,
      kindKey: kindKeyOf(pet.kind),
      art: (pet.kind === 'DOG' ? 'dog' : 'cat') as PetArtKind,
    })),
  );

  /** The last few pages written, each with the name of the pet it belongs to. */
  readonly recentCards = computed(() => {
    const names = new Map(this.petRows().map((pet) => [pet._id, pet.name]));
    return this.recent().map((memory) => ({
      memory,
      petName: names.get(memory.pet) ?? '',
      topicKey: topicKey(memory.topic),
    }));
  });

  readonly flashbackYears = computed(() => {
    const one = this.flashback();
    return one ? yearsAgo(one.happenedAt) : 0;
  });

  readonly noPets = computed(() => this.petRows().length === 0);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.status.set('LOADING');
    forkJoin({
      pets: this.pets.list(),
      recent: this.memories.recent().pipe(catchError(() => of<Memory[]>([]))),
      flashback: this.memories.onThisDay().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (all) => {
          this.petRows.set(all.pets);
          this.recent.set(all.recent.slice(0, RECENT_MAX));
          this.flashback.set(all.flashback);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });
  }
}
