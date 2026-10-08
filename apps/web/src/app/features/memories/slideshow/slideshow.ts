import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Memory, MusicTrack } from '../../../core/models/api.model';
import { Icon } from '../../../shared/icon/icon';

/** Ba kieu chuyen canh hop dong yeu cau. */
export type SlideEffect = 'FADE' | 'SLIDE' | 'ZOOM';

/** Cach trinh chieu, dung chung giua chu quyen va nguoi cam duong dan. */
export interface SlideSetting {
  trackCode: string;
  effect: SlideEffect;
  seconds: number;
}

/** Mot khung hinh cua trinh chieu: mot buc anh kem loi cua khoanh khac. */
interface Frame {
  photoId: string;
  source: string;
  title: string;
  happenedAt: string;
  place: string;
  body: string;
}

/** Ten hien cua tung kieu chuyen canh, viet san de khong ghep chuoi. */
export const EFFECT_KEY: Record<SlideEffect, string> = {
  FADE: 'MEMORY.EFFECT_FADE',
  SLIDE: 'MEMORY.EFFECT_SLIDE',
  ZOOM: 'MEMORY.EFFECT_ZOOM',
};

export const EFFECT_ORDER: SlideEffect[] = ['FADE', 'SLIDE', 'ZOOM'];

/** Thoi luong moi anh duoc phep chon, theo dung khoang hop dong ghi. */
export const SECOND_CHOICES = [3, 4, 5, 6, 8, 10];

const A_SECOND = 1000;

/**
 * Trinh chieu mot quyen nhat ky kem nhac nen.
 *
 * Dung chung cho ca chu quyen lan nguoi cam duong dan chia se, nen no khong
 * biet gi ve dang nhap: no chi nhan noi dung da doc san va cach trinh chieu.
 *
 * Trinh duyet thuong chan tieng khi trang chua duoc cham vao. O day khong
 * coi do la loi: nut bat tieng van nam san, va anh van chay binh thuong.
 */
@Component({
  selector: 'pm-slideshow',
  standalone: true,
  imports: [DatePipe, TranslatePipe, Icon],
  templateUrl: './slideshow.html',
  styleUrl: './slideshow.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Slideshow {
  private readonly destroyRef = inject(DestroyRef);

  readonly moments = input.required<Memory[]>();

  /** Dia chi xem duoc cua tung buc anh, tra theo ma anh. */
  readonly sourceOf = input.required<Record<string, string>>();
  readonly setting = input.required<SlideSetting>();
  readonly tracks = input<MusicTrack[]>([]);

  /** Nguoi dang xem co duoc doi cach trinh chieu khong. */
  readonly canChange = input(false);

  /** Bao ra ngoai khi nguoi xem doi cach trinh chieu, de chu quyen luu lai. */
  readonly settingChanged = output<Partial<SlideSetting>>();

  readonly at = signal(0);
  readonly playing = signal(false);
  readonly muted = signal(false);

  /**
   * The phat nhac nen.
   *
   * Trinh duyet chan tu phat nhac khi nguoi xem chua bam gi, nen nhac chi bat
   * khi nguoi xem bam phat, va dung khi bam tam dung. Viec bat tat phai goi
   * thang vao the phat, vi khong co cach rang buoc nao khac lam duoc dieu nay.
   */
  private readonly player = viewChild<ElementRef<HTMLAudioElement>>('player');

  private ticker: ReturnType<typeof setInterval> | null = null;

  private readonly stopTicker = this.destroyRef.onDestroy(() => this.clearTicker());

  /** Moi buc anh la mot khung hinh, kem loi cua khoanh khac chua no. */
  readonly frames = computed<Frame[]>(() => {
    const seen = this.sourceOf();
    const out: Frame[] = [];
    // Trinh chieu ke theo dong thoi gian, nen di tu khoanh khac cu nhat.
    for (const moment of [...this.moments()].reverse()) {
      for (const id of moment.photo) {
        if (seen[id]) {
          out.push({
            photoId: id,
            source: seen[id],
            title: moment.title,
            happenedAt: moment.happenedAt,
            place: moment.place,
            body: moment.body,
          });
        }
      }
    }
    return out;
  });

  readonly total = computed(() => this.frames().length);
  readonly current = computed(() => this.frames()[this.at()] ?? null);

  /** Khung dang chieu, boc trong mot day de mau xem ve lai tung the mot. */
  readonly shown = computed<Frame[]>(() => {
    const one = this.current();
    return one ? [one] : [];
  });

  /** Bai nhac dang chon, hoac khong co gi khi kho nhac con trong. */
  readonly track = computed(
    () => this.tracks().find((one) => one.code === this.setting().trackCode) ?? null,
  );

  readonly effectClass = computed(() => `is-${this.setting().effect.toLowerCase()}`);

  constructor() {
    // Nhac di theo trang thai trinh chieu: dang chay thi phat, tam dung thi dung.
    effect(() => {
      const player = this.player()?.nativeElement;
      const wanted = this.playing() && this.track() !== null;
      if (!player) {
        return;
      }
      if (wanted) {
        player.play().catch(() => this.playing.set(false));
      } else {
        player.pause();
      }
    });

    /*
     * Doi thoi luong moi anh thi nhip chay phai doi theo ngay, khong doi den
     * luc nguoi xem dung roi chay lai.
     */
    effect(() => {
      const gap = this.setting().seconds;
      if (this.playing()) {
        this.startTicker(gap);
      }
    });
  }

  play(): void {
    if (this.total() === 0) {
      return;
    }
    this.playing.set(true);
    this.startTicker(this.setting().seconds);
  }

  pause(): void {
    this.playing.set(false);
    this.clearTicker();
  }

  next(): void {
    if (this.total() === 0) {
      return;
    }
    this.at.set((this.at() + 1) % this.total());
  }

  previous(): void {
    if (this.total() === 0) {
      return;
    }
    this.at.set((this.at() + this.total() - 1) % this.total());
  }

  toggleSound(): void {
    this.muted.set(!this.muted());
  }

  chooseTrack(event: Event): void {
    this.settingChanged.emit({ trackCode: (event.target as HTMLSelectElement).value });
  }

  chooseEffect(effectName: SlideEffect): void {
    this.settingChanged.emit({ effect: effectName });
  }

  chooseSeconds(event: Event): void {
    this.settingChanged.emit({ seconds: Number((event.target as HTMLSelectElement).value) });
  }

  readonly effects = EFFECT_ORDER.map((one) => ({ value: one, key: EFFECT_KEY[one] }));
  readonly secondChoices = SECOND_CHOICES;

  private startTicker(gap: number): void {
    this.clearTicker();
    this.ticker = setInterval(() => this.next(), Math.max(3, gap) * A_SECOND);
  }

  private clearTicker(): void {
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
}
