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
import { PhotosService } from '../../core/services/photos.service';
import { AuthService } from '../../core/services/auth.service';
import { Memory, Pet, PetPhoto } from '../../core/models/api.model';
import { kindKeyOf } from '../../shared/pet-labels';
import { topicKey } from '../../shared/memory-topics';
import { Icon } from '../../shared/icon/icon';
import { PetArt, PetArtKind } from '../../shared/pet-art/pet-art';
import { PetFace } from '../../shared/pet-face/pet-face';
import { BounceText } from '../../shared/fx/bounce-text';
import { RevealDirective } from '../../shared/fx/reveal.directive';
import { TiltDirective } from '../../shared/fx/tilt.directive';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

const DAY_MS = 86_400_000;
const RECENT_MAX = 3;

/** Nhip doi anh trong khung hoi tuong (ms). */
const FLASH_BEAT_MS = 1600;

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
  imports: [PetFace, RouterLink, DatePipe, TranslatePipe, Icon, PetArt, BounceText, RevealDirective, TiltDirective],
  templateUrl: './today-page.html',
  styleUrl: './today-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayPage implements OnInit {
  private readonly pets = inject(PetsService);
  private readonly memories = inject(MemoriesService);
  private readonly auth = inject(AuthService);

  /** Ba buc tranh len troi trong the Studio; slot quyet dinh vi tri va nhip troi. */
  readonly promoFloats = [
    { slot: 'a', file: 'ginger-frame-cut', width: 374, height: 390 },
    { slot: 'b', file: 'calico-frame-cut', width: 211, height: 268 },
    { slot: 'c', file: 'scottish-frame-cut', width: 316, height: 370 },
  ];
  private readonly destroyRef = inject(DestroyRef);
  private readonly photos = inject(PhotosService);

  /** Ma tat ca anh cua cuon album dang phat, theo thu tu thoi gian. */
  private readonly flashIds = signal<string[]>([]);

  /** Ten be cua cuon album duoc chon ngau nhien lan nay. */
  readonly flashAlbumName = signal('');

  /** Ma be cua cuon album dang phat; nut mo lai nhat ky dan toi dung cuon nay. */
  readonly flashAlbumPet = signal<string | null>(null);

  /** Moi o dem rieng so lan da doi anh; ba o doi lan luot nen so le nhau. */
  private readonly flashTurns = signal<number[]>([0, 0, 0]);

  /** Anh da tai: ma anh sang dia chi tam. Chi giu cac anh quanh vi tri dang phat. */
  private readonly flashCache = new Map<string, string>();
  private readonly flashLoading = new Set<string>();
  private readonly flashCacheVersion = signal(0);

  /**
   * Anh tung o dang hien, kem anh vua roi de anh moi mo dan de len anh cu.
   * Album it anh (tu ba tro xuong): ca ba o xoay chung mot nac de khong trung nhau.
   * Album nhieu anh: o thu t lan luot chieu cac anh t, t+3, t+6... nen ba o cung
   * nhau chieu het ca cuon.
   */
  readonly flashTiles = computed(() => {
    const ids = this.flashIds();
    this.flashCacheVersion();
    if (ids.length === 0) {
      return [];
    }
    const turns = this.flashTurns();
    return [0, 1, 2].map((tile) => {
      const now = this.flashSlot(ids, turns, tile, 0);
      const before = this.flashSlot(ids, turns, tile, -1);
      const frames = [...new Set([before, now])]
        .map((at) => ids[at])
        .filter((id) => this.flashCache.has(id))
        .map((id) => ({ id, url: this.flashCache.get(id) ?? '', on: id === ids[now] }));
      return { frames };
    });
  });

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
          this.pickFlashAlbum(all.pets);
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /** Vi tri anh cua mot o, lech them 'shift' nhip so voi hien tai (-1 la anh truoc). */
  private flashSlot(ids: string[], turns: number[], tile: number, shift: number): number {
    const n = ids.length;
    if (n <= 3) {
      const together = turns.reduce((sum, one) => sum + one, 0) + shift;
      return (((tile + together) % n) + n) % n;
    }
    return (((tile + (turns[tile] + shift) * 3) % n) + n) % n;
  }

  /**
   * Moi lan vao trang chon ngau nhien mot cuon album (nhat ky va album anh cua mot
   * be) roi lay toan bo anh cua cuon do. Be duoc chon chua co anh thi thu be khac.
   */
  private pickFlashAlbum(pets: Pet[]): void {
    const order = [...pets].sort(() => Math.random() - 0.5);
    const tryAt = (at: number): void => {
      const pet = order[at];
      if (!pet) {
        return;
      }
      forkJoin({
        diary: this.memories.allForPet(pet._id).pipe(catchError(() => of<Memory[]>([]))),
        album: this.photos.list(pet._id).pipe(catchError(() => of<PetPhoto[]>([]))),
      })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(({ diary, album }) => {
          const fromDiary = [...diary]
            .sort((x, y) => x.happenedAt.localeCompare(y.happenedAt))
            .flatMap((one) => one.photo ?? []);
          const fromAlbum = [...album].sort((x, y) => x.createdAt.localeCompare(y.createdAt)).map((one) => one._id);
          const ids = [...new Set([...fromDiary, ...fromAlbum])];
          if (ids.length === 0) {
            tryAt(at + 1);
            return;
          }
          this.flashAlbumName.set(pet.name);
          this.flashAlbumPet.set(pet._id);
          this.flashIds.set(ids);
          this.prefetchFlash();
          this.startFlashCycle();
        });
    };
    tryAt(0);
    this.destroyRef.onDestroy(() => {
      this.flashCache.forEach((url) => URL.revokeObjectURL(url));
      this.flashCache.clear();
    });
  }

  /**
   * Tai truoc anh dang hien, anh vua roi va hai anh ke tiep cua tung o; bo cac anh
   * nam ngoai khoang do de cuon album vai tram anh van nhe.
   */
  private prefetchFlash(): void {
    const ids = this.flashIds();
    const turns = this.flashTurns();
    const wanted = new Set<string>();
    for (const tile of [0, 1, 2]) {
      for (const shift of [-1, 0, 1, 2]) {
        wanted.add(ids[this.flashSlot(ids, turns, tile, shift)]);
      }
    }
    for (const [id, url] of this.flashCache) {
      if (!wanted.has(id)) {
        URL.revokeObjectURL(url);
        this.flashCache.delete(id);
      }
    }
    for (const id of wanted) {
      if (this.flashCache.has(id) || this.flashLoading.has(id)) {
        continue;
      }
      this.flashLoading.add(id);
      this.photos
        .content(id)
        .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
        .subscribe((blob) => {
          this.flashLoading.delete(id);
          if (blob) {
            this.flashCache.set(id, URL.createObjectURL(blob));
            this.flashCacheVersion.update((one) => one + 1);
          }
        });
    }
  }

  /** Moi nhip doi anh mot o, lan luot ba o; anh ke tiep chua tai xong thi doi nhip sau. */
  private startFlashCycle(): void {
    if (this.flashIds().length <= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    let tick = 0;
    const timer = setInterval(() => {
      const ids = this.flashIds();
      const tile = tick % 3;
      const next = ids[this.flashSlot(ids, this.flashTurns(), tile, 1)];
      if (!this.flashCache.has(next)) {
        this.prefetchFlash();
        return;
      }
      tick += 1;
      this.flashTurns.update((turns) => turns.map((one, at) => (at === tile ? one + 1 : one)));
      this.prefetchFlash();
    }, FLASH_BEAT_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }
}
