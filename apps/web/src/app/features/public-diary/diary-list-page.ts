import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { MemoriesService } from '../../core/services/memories.service';
import { DiaryList, MemoryTopic } from '../../core/models/api.model';
import { TOPIC_ORDER, topicKey } from '../../shared/memory-topics';
import { Icon } from '../../shared/icon/icon';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

const NOTHING: DiaryList = { rows: [], total: 0, page: 1, pageCount: 1 };

/**
 * Cac quyen nhat ky dang de cong khai.
 *
 * Doc duoc khi chua dang nhap, va khong co binh luan, tha cam xuc hay theo
 * doi: hop dong chi yeu cau xem danh sach va noi dung.
 */
@Component({
  selector: 'pm-diary-list-page',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslatePipe, Icon],
  templateUrl: './diary-list-page.html',
  styleUrl: './diary-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiaryListPage implements OnInit {
  private readonly service = inject(MemoriesService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly answer = signal<DiaryList>(NOTHING);
  readonly topic = signal<MemoryTopic | null>(null);

  readonly form = this.fb.nonNullable.group({ keyword: [''] });

  readonly chips = [
    { topic: null, key: 'MEMORY.TOPIC_ALL' },
    ...TOPIC_ORDER.map((one) => ({ topic: one, key: topicKey(one) })),
  ];

  readonly rows = computed(() => this.answer().rows);
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
