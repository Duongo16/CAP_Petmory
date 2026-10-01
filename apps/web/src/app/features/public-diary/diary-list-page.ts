import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { MemoriesService } from '../../core/services/memories.service';
import { DiaryCard, DiaryList, MemoryTopic } from '../../core/models/api.model';
import { TOPIC_ORDER, topicKey } from '../../shared/memory-topics';
import { Icon } from '../../shared/icon/icon';
import { PetFace } from '../../shared/pet-face/pet-face';
import { UserFace } from '../../shared/user-face/user-face';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

const NOTHING: DiaryList = { rows: [], total: 0, page: 1, pageCount: 1 };

/** Mau bia cac quyen thay phien nhau doc theo gia, giong tu sach cua chu nhan. */
const TONES = ['clay', 'olive', 'cocoa', 'honey'] as const;
type Tone = (typeof TONES)[number];

/** Be ngang cua quyen sach khi da bay ra giua man hinh. */
const OPEN_WIDTH = 300;

interface Book {
  card: DiaryCard;
  tone: Tone;
}

/** Mot quyen dang bay tu gia ra giua man hinh. */
interface Flight {
  book: Book;
  dx: number;
  dy: number;
  scale: number;
}

/**
 * Cac quyen nhat ky dang de cong khai, xep tren mot gia sach.
 *
 * Giong tu sach cua chu nhan, nhung moi bia con ghi ro quyen do cua ai. Doc
 * duoc khi chua dang nhap, va khong co binh luan, tha cam xuc hay theo doi.
 */
@Component({
  selector: 'pm-diary-list-page',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Icon, PetFace, UserFace],
  templateUrl: './diary-list-page.html',
  styleUrl: './diary-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiaryListPage implements OnInit {
  private readonly service = inject(MemoriesService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly answer = signal<DiaryList>(NOTHING);
  readonly topic = signal<MemoryTopic | null>(null);
  readonly flight = signal<Flight | null>(null);

  readonly form = this.fb.nonNullable.group({ keyword: [''] });

  readonly chips = [
    { topic: null, key: 'MEMORY.TOPIC_ALL' },
    ...TOPIC_ORDER.map((one) => ({ topic: one, key: topicKey(one) })),
  ];

  readonly books = computed<Book[]>(() =>
    this.answer().rows.map((card, at) => ({ card, tone: TONES[at % TONES.length] })),
  );
  readonly page = computed(() => this.answer().page);
  readonly pageCount = computed(() => this.answer().pageCount);

  ngOnInit(): void {
    this.read(1);
  }

  choose(topic: MemoryTopic | null): void {
    this.topic.set(topic);
    this.read(1);
  }

  search(): void {
    this.read(1);
  }

  changePage(step: number): void {
    const next = Math.min(this.pageCount(), Math.max(1, this.page() + step));
    if (next !== this.page()) {
      this.read(next);
    }
  }

  /** Lay quyen sach xuong tu dung cho vua bam. */
  pick(book: Book, event: Event): void {
    if (this.flight()) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.openBook(book);
      return;
    }
    const from = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.flight.set({
      book,
      dx: from.left + from.width / 2 - window.innerWidth / 2,
      dy: from.top + from.height / 2 - window.innerHeight / 2,
      scale: from.width / OPEN_WIDTH,
    });
  }

  /** Bia da mo xong thi chuyen sang doc quyen nhat ky. */
  arrived(event: AnimationEvent): void {
    const book = this.flight()?.book;
    if (book && event.animationName.includes('bs-open')) {
      this.openBook(book);
    }
  }

  private openBook(book: Book): void {
    void this.router.navigate(['/diaries', book.card.petId]);
  }

  private read(page: number): void {
    this.status.set('LOADING');
    this.service
      .publicDiaries(page, this.topic() ?? undefined, this.form.getRawValue().keyword.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fresh) => {
          this.answer.set(fresh);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });
  }
}
