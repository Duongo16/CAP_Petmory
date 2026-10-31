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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';
import { MemoriesService } from '../../core/services/memories.service';
import { AuthService } from '../../core/services/auth.service';
import { DiaryBook, MusicTrack } from '../../core/models/api.model';
import { groupByMonth } from '../memories/memories-facade';
import { JourneyMap } from '../memories/journey-map/journey-map';
import { SlideSetting, Slideshow, SlideEffect } from '../memories/slideshow/slideshow';
import { DiaryBookView } from '../memories/book/diary-book';
import { DiaryMusicPlayer } from '../memories/diary-music/diary-music';
import { PageFace } from '../memories/book/page-face';
import { PaperKind } from '../../shared/diary-art';
import { Icon } from '../../shared/icon/icon';
import { GuestHeader } from '../../shared/guest-header/guest-header';

type ScreenState = 'LOADING' | 'MISSING' | 'ERROR' | 'DONE';

/** Cach trinh chieu mac dinh khi quyen chua dat gi. */
const PLAIN_SETTING: SlideSetting = { trackCode: '', effect: 'FADE', seconds: 5 };

/**
 * Doc mot quyen nhat ky dang de cong khai, hoac mo bang duong dan chia se.
 *
 * Trang nay khong doi hoi dang nhap, va khong co bat ky nut nao de viet, binh
 * luan, tha cam xuc hay theo doi: hop dong chi cho xem.
 */
@Component({
  selector: 'pm-diary-book-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe, Slideshow, DiaryBookView, DiaryMusicPlayer, Icon, GuestHeader, JourneyMap],
  templateUrl: './diary-book-page.html',
  styleUrl: './diary-book-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiaryBookPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MemoriesService);
  /** Da dang nhap thi trang nam trong khung chung, nen khong ve dau trang cua khach. */
  readonly signedIn = inject(AuthService).isSignedIn;
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly book = signal<DiaryBook | null>(null);
  readonly tracks = signal<MusicTrack[]>([]);
  readonly showing = signal(false);
  readonly shareCode = this.route.snapshot.paramMap.get('code') ?? '';

  /** Doc theo quyen so lat trang, hay theo danh sach doc. */
  readonly asBook = signal(true);

  /** The pet's avatar, else the first photo the diary shows publicly. */
  readonly coverFace = computed(() => {
    const whole = this.book();
    const first = whole?.photo[0];
    return whole?.pet.avatarUrl || (first ? this.service.publicPhotoLink(first._id) : '');
  });

  /** Dia chi xem duoc cua tung buc anh, tra theo ma anh. */
  readonly sourceOf = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const one of this.book()?.photo ?? []) {
      out[one._id] = this.service.publicPhotoLink(one._id);
    }
    return out;
  });

  readonly moments = computed(() => this.book()?.moments ?? []);

  readonly setting = computed<SlideSetting>(() => {
    const kept = this.book()?.pet.slide;
    if (!kept) {
      return PLAIN_SETTING;
    }
    return {
      trackCode: kept.trackCode,
      effect: kept.effect as SlideEffect,
      seconds: kept.seconds,
    };
  });

  /** Cac khoanh khac gom theo thang, ve thanh ban do hanh trinh nhu nhat ky cua chu. */
  readonly months = computed(() => groupByMonth(this.moments(), this.sourceOf()));

  ngOnInit(): void {
    this.load();
  }

  retry(): void {
    this.load();
  }

  private load(): void {
    this.status.set('LOADING');
    const code = this.route.snapshot.paramMap.get('code');
    const petId = this.route.snapshot.paramMap.get('petId');
    const reading = code ? this.service.diaryByShare(code) : this.service.publicDiary(petId ?? '');
    forkJoin({
      book: reading,
      music: this.service.music().pipe(catchError(() => of([] as MusicTrack[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (both) => {
          this.book.set(both.book);
          this.tracks.set(both.music);
          this.status.set('DONE');
        },
        error: (failure: { status?: number }) =>
          this.status.set(failure.status === 404 ? 'MISSING' : 'ERROR'),
      });
  }

  /**
   * Cac mat giay cua quyen so.
   *
   * Nguoi doc tu ben ngoai thay dung quyen so ma chu da bay tri, chi khac o
   * cho khong sua duoc gi.
   */
  readonly faces = computed<PageFace[]>(() => {
    const whole = this.book();
    if (!whole) {
      return [];
    }
    const rows = [...whole.moments].reverse();
    const out: PageFace[] = [
      {
        kind: 'COVER',
        number: 0,
        moment: null,
        paper: 'KRAFT',
        petName: whole.pet.name,
        tagline: whole.pet.tagline,
        avatarUrl: this.coverFace(),
        momentCount: whole.pet.momentCount,
      },
    ];
    rows.forEach((one, at) => {
      out.push({
        kind: 'MOMENT',
        number: at + 1,
        moment: one,
        paper: (one.paper || 'CREAM') as PaperKind,
        petName: '',
        tagline: '',
        avatarUrl: '',
        momentCount: 0,
      });
    });
    out.push({
      kind: 'END',
      number: 0,
      moment: null,
      paper: 'KRAFT',
      petName: '',
      tagline: '',
      avatarUrl: '',
      momentCount: 0,
    });
    return out;
  });

  showBook(wanted: boolean): void {
    this.asBook.set(wanted);
  }

  toggleShow(): void {
    this.showing.set(!this.showing());
  }
}
