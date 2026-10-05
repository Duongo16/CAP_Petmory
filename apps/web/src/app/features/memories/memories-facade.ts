import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, forkJoin, of, switchMap, timer } from 'rxjs';
import { MemoriesService, WriteMemoryInput } from '../../core/services/memories.service';
import { PetsService } from '../../core/services/pets.service';
import { PhotosService } from '../../core/services/photos.service';
import { StoriesService } from '../../core/services/stories.service';
import {
  DecorItem,
  DiaryExport,
  DiaryPage,
  DiaryShare,
  Memory,
  MemoryTopic,
  Pet,
  PetPhoto,
  PetStory,
} from '../../core/models/api.model';
import { TOPIC_ORDER, topicKey, topicTone } from '../../shared/memory-topics';

/** Mot buc anh trong album, kem dia chi tam de ve ra man hinh. */
export interface AlbumShot {
  id: string;
  source: string;
}

/**
 * Bo cac o trong truoc khi gui len may chu.
 *
 * May chu chi nhan nhung gia tri co nghia: ma hinh dan phai la mot hinh co
 * that, ma mau phai la mot ma mau. Mot o trong khong phai la khong dat gi,
 * ma la mot gia tri sai, nen phai bo han thay vi gui di.
 */
function tidyItem(one: DecorItem): DecorItem {
  const out: Record<string, unknown> = {
    kind: one.kind,
    x: one.x,
    y: one.y,
    width: one.width,
    rotate: one.rotate,
    z: one.z,
  };
  if (one.text) {
    out['text'] = one.text;
  }
  if (one.photo) {
    out['photo'] = one.photo;
  }
  if (one.sticker) {
    out['sticker'] = one.sticker;
  }
  if (one.color) {
    out['color'] = one.color;
  }
  if (one.fontKey) {
    out['fontKey'] = one.fontKey;
  }
  return out as unknown as DecorItem;
}

/** Bao lau hoi lai may chu mot lan khi dang cho tep xuat xong. */
const POLL_MS = 1500;

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

/** One filter chip above the diary, carrying how many moments sit behind it. */
export interface TopicChip {
  topic: MemoryTopic | null;
  key: string;
  count: number;
}

/** One moment ready to show, with its wording and colour worked out. */
export interface MomentCard {
  raw: Memory;
  topicKey: string;
  topicTone: string;
  /** The first photograph of the moment, ready for an img, or empty. */
  cover: string;
  photoCount: number;
  /** Which side of the road the stop sits on in the journey map. */
  side: 'left' | 'right';
  /** Cau chuyen da gan vao khoanh khac nay, rong khi chua gan. */
  story: PetStory | null;
}

/** A run of moments that happened in the same month, as the design groups them. */
export interface MonthGroup {
  /** The first day of the month, used both as key and for the heading. */
  startedAt: string;
  cards: MomentCard[];
}

const EMPTY_PAGE: DiaryPage = {
  rows: [],
  total: 0,
  page: 1,
  pageCount: 1,
  countByTopic: {},
  milestoneCount: 0,
};

/** The first day of the month a date falls in, as a sortable string. */
function monthOf(when: string): string {
  const at = new Date(when);
  return new Date(at.getFullYear(), at.getMonth(), 1).toISOString();
}

/**
 * Holds one pet's diary: the moments, the filter above them and the writing
 * of new ones. The screen only reads signals and issues commands.
 */
@Injectable()
export class MemoriesFacade {
  private readonly service = inject(MemoriesService);
  private readonly pets = inject(PetsService);
  private readonly photos = inject(PhotosService);
  private readonly stories = inject(StoriesService);

  /** Cau chuyen moi nhat gan vao tung khoanh khac, tra theo ma khoanh khac. */
  private readonly storyByMoment = signal<Map<string, PetStory>>(new Map());
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<ScreenState>('LOADING');
  private readonly answer = signal<DiaryPage>(EMPTY_PAGE);
  private readonly topic = signal<MemoryTopic | null>(null);
  private readonly petRow = signal<Pet | null>(null);
  private readonly saving = signal(false);
  private petId = '';

  /** The pet whose diary is open. */
  get currentPetId(): string {
    return this.petId;
  }

  private readonly cleanup = this.destroyRef.onDestroy(() => this.releaseShots());

  /** Album cua be, de nguoi dung chon anh gan vao mot khoanh khac. */
  private readonly album = signal<AlbumShot[]>([]);

  private readonly shareRows = signal<DiaryShare[]>([]);
  private readonly freshCode = signal('');
  private readonly exportRow = signal<DiaryExport | null>(null);

  /** Loi khi luu mot trang so, de man hinh noi ra chu khong im lang. */
  readonly pageProblem = signal<string | null>(null);

  readonly shots = this.album.asReadonly();
  readonly shares = this.shareRows.asReadonly();
  readonly newCode = this.freshCode.asReadonly();
  readonly exporting = this.exportRow.asReadonly();

  /** Quyen nay dang de cho nguoi ngoai doc hay khong. */
  readonly isPublic = computed(() => this.petRow()?.diaryPublic ?? false);

  /** Quan tri vien da an quyen nay chua, va vi ly do gi. */
  readonly blocked = computed(() => this.petRow()?.diaryBlocked ?? false);
  readonly blockReason = computed(() => this.petRow()?.diaryBlockReason ?? '');

  readonly status = this.state.asReadonly();
  readonly pet = this.petRow.asReadonly();
  readonly chosen = this.topic.asReadonly();
  readonly pending = this.saving.asReadonly();

  readonly total = computed(() => this.answer().total);
  readonly page = computed(() => this.answer().page);
  readonly pageCount = computed(() => this.answer().pageCount);
  readonly empty = computed(() => this.answer().rows.length === 0);

  readonly chips = computed<TopicChip[]>(() => {
    const counts = this.answer().countByTopic;
    const all = Object.values(counts).reduce<number>((sum, one) => sum + (one ?? 0), 0);
    return [
      { topic: null, key: 'MEMORY.TOPIC_ALL', count: all },
      ...TOPIC_ORDER.map((topic) => ({
        topic,
        key: topicKey(topic),
        count: counts[topic] ?? 0,
      })),
    ];
  });

  /** The page's moments gathered by the month they happened in. */
  readonly months = computed<MonthGroup[]>(() => {
    const groups = new Map<string, MomentCard[]>();
    const seen = this.shotSource();
    const told = this.storyByMoment();
    let at = 0;
    for (const raw of this.answer().rows) {
      const key = monthOf(raw.happenedAt);
      const first = raw.photo[0] ?? raw.decor.find((one) => one.kind === 'PHOTO')?.photo ?? '';
      const card: MomentCard = {
        raw,
        topicKey: topicKey(raw.topic),
        topicTone: topicTone(raw.topic),
        cover: first ? (seen[first] ?? '') : '',
        photoCount: raw.photo.length,
        side: at % 2 === 0 ? 'left' : 'right',
        story: told.get(raw._id) ?? null,
      };
      at += 1;
      const already = groups.get(key);
      if (already) {
        already.push(card);
      } else {
        groups.set(key, [card]);
      }
    }
    return [...groups].map(([startedAt, cards]) => ({ startedAt, cards }));
  });

  start(petId: string): void {
    this.petId = petId;
    this.state.set('LOADING');
    forkJoin({
      pet: this.pets.byId(petId),
      diary: this.service.forPet(petId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (both) => {
          this.petRow.set(both.pet);
          this.answer.set(both.diary);
          this.state.set('DONE');
          this.loadAlbum();
          this.loadShares();
          this.loadStories();
        },
        error: () => this.state.set('ERROR'),
      });
  }

  /**
   * Doc cac cau chuyen cua be de biet khoanh khac nao da duoc gan cau chuyen.
   *
   * Danh sach xep ban moi truoc, nen gap ban dau tien cho moi khoanh khac la
   * ban gan gan nhat. Doc hong thi chi khong hien nut doc cau chuyen.
   */
  private loadStories(): void {
    this.stories
      .list(this.petId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          const found = new Map<string, PetStory>();
          for (const one of rows) {
            if (one.attachedMemory && !found.has(one.attachedMemory)) {
              found.set(one.attachedMemory, one);
            }
          }
          this.storyByMoment.set(found);
        },
        error: () => this.storyByMoment.set(new Map()),
      });
  }

  choose(topic: MemoryTopic | null): void {
    this.topic.set(topic);
    this.read(1);
  }

  changePage(step: number): void {
    const next = Math.min(this.pageCount(), Math.max(1, this.page() + step));
    if (next !== this.page()) {
      this.read(next);
    }
  }

  /** Writes a new moment, then shows the page it belongs on. */
  write(input: Omit<WriteMemoryInput, 'pet'>): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.service
      .write({ ...input, decor: input.decor?.map(tidyItem), pet: this.petId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          // Photographs uploaded while writing are new to the album, so read it again.
          this.loadAlbum();
          this.topic.set(null);
          this.read(1);
        },
        error: () => this.saving.set(false),
      });
  }

  remove(one: Memory): void {
    this.service
      .hide(one._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.read(this.page()), error: () => undefined });
  }

  /** Doc album cua be, de hop viet khoanh khac co anh ma chon. */
  loadAlbum(): void {
    this.photos
      .list(this.petId)
      .pipe(
        switchMap((rows) => {
          const kept = rows.filter((one) => !one.isRestored);
          if (kept.length === 0) {
            return of({ rows: kept, blobs: [] as Blob[] });
          }
          return forkJoin(kept.map((one) => this.photos.content(one._id))).pipe(
            switchMap((blobs) => of({ rows: kept, blobs })),
          );
        }),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((both) => {
        this.releaseShots();
        this.album.set(
          both.rows.map((row: PetPhoto, at: number) => ({
            id: row._id,
            source: both.blobs[at] ? URL.createObjectURL(both.blobs[at]) : '',
          })),
        );
      });
  }

  /** Tra lai bo nho cua cac dia chi tam da tao cho album. */
  private releaseShots(): void {
    for (const one of this.album()) {
      if (one.source) {
        URL.revokeObjectURL(one.source);
      }
    }
  }

  /** Bat hoac tat che do cong khai cho ca quyen. */
  setPublic(wanted: boolean): void {
    this.service
      .setPrivacy(this.petId, wanted)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pet) => {
          this.petRow.set(pet);
          /*
           * Rut ve rieng tu thi may chu thu hoi het duong dan dang mo, nen
           * danh sach tren man hinh phai doc lai chu khong doan theo.
           */
          this.loadShares();
        },
        error: () => undefined,
      });
  }

  /** Dia chi xem duoc cua tung buc anh trong album, tra theo ma anh. */
  readonly shotSource = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const one of this.album()) {
      out[one.id] = one.source;
    }
    return out;
  });

  /**
   * Luu cach bay tri cua mot trang so.
   *
   * Ghi thang vao khoanh khac do, roi doc lai dung trang dang xem, de quyen
   * so ve lai ngay ma khong phai tai lai ca man hinh.
   */
  keepPage(momentId: string, decor: DecorItem[], paper: string): void {
    this.pageProblem.set(null);
    this.service
      .change(momentId, { decor: decor.map(tidyItem), paper })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fresh) => this.replaceOne(fresh),
        error: () => this.pageProblem.set('BOOK.SAVE_FAILED'),
      });
  }

  /** Thay mot khoanh khac trong trang dang xem bang ban vua luu. */
  private replaceOne(fresh: Memory): void {
    const page = this.answer();
    this.answer.set({
      ...page,
      rows: page.rows.map((one) => (one._id === fresh._id ? fresh : one)),
    });
  }

  loadShares(): void {
    this.service
      .listShares(this.petId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (rows) => this.shareRows.set(rows), error: () => undefined });
  }

  /** Tao mot duong dan chia se. Ma tra ve chi hien dung lan nay. */
  makeShare(expiresAt?: string): void {
    this.freshCode.set('');
    this.service
      .makeShare(this.petId, expiresAt)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (made) => {
          this.freshCode.set(made.code);
          this.loadShares();
        },
        error: () => undefined,
      });
  }

  revokeShare(id: string): void {
    this.service
      .revokeShare(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.loadShares(), error: () => undefined });
  }

  /**
   * Xin xuat quyen ra tep, roi hoi lai cho den khi may chu bao xong.
   *
   * Hoi lai bang mot dong thoi gian noi tiep vao yeu cau dau, nen khong co
   * hai duong theo doi cung chay, va tat ca deu tat khi roi man hinh.
   */
  askExport(fromDate?: string, toDate?: string): void {
    this.exportRow.set(null);
    this.service
      .askExport(this.petId, fromDate, toDate)
      .pipe(
        switchMap((first) => {
          this.exportRow.set(first);
          return timer(POLL_MS, POLL_MS).pipe(
            switchMap(() => this.service.exportState(first._id).pipe(catchError(() => EMPTY))),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((fresh) => {
        this.exportRow.set(fresh);
      });
  }

  private read(page: number): void {
    this.service
      .forPet(this.petId, page, this.topic() ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fresh) => this.answer.set(fresh),
        error: () => this.state.set('ERROR'),
      });
  }
}
