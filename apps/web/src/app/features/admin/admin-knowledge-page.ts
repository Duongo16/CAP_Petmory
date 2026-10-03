import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, debounceTime, filter, switchMap, catchError, of } from 'rxjs';
import {
  AssistantKnowledgeService,
  KnowledgeEntry,
  KnowledgeInput,
  KnowledgeTopic,
} from '../../core/services/assistant-knowledge.service';
import { Icon } from '../../shared/icon/icon';
import { KnowledgeFormDialog, KnowledgeFormInput } from './knowledge-form-dialog';
import { TOPIC_KEY, TOPIC_KEYS } from './knowledge-topics';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

/** Mot dong cua bang, da tinh san moi thu khung nhin can. */
interface Row {
  raw: KnowledgeEntry;
  topicKey: string;
  keywordText: string;
}

const SHEET = { width: 'min(760px, 96vw)', maxHeight: '94vh', panelClass: 'pm-dialog' };

/** Do tre truoc khi tim theo chu vua go, tinh bang mili giay. */
const TYPE_DELAY_MS = 300;

/**
 * Kho tri thuc cua tro ly hoi thoai (Phu luc 01, muc 9).
 *
 * Nhom Quan ly soan cau hoi, tu khoa va cau tra loi o day; tro ly doc ra de
 * tra loi khach, va dua ca kho vao loi dan khi goi mo hinh ngon ngu.
 */
@Component({
  selector: 'pm-admin-knowledge-page',
  standalone: true,
  imports: [TranslatePipe, Icon],
  templateUrl: './admin-knowledge-page.html',
  styleUrl: './admin-knowledge-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminKnowledgePage implements OnInit {
  private readonly service = inject(AssistantKnowledgeService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly problem = signal<string | null>(null);
  readonly sending = signal(false);
  readonly topic = signal<KnowledgeTopic | null>(null);
  readonly keyword = signal('');

  private readonly entries = signal<KnowledgeEntry[]>([]);
  private readonly typed = new Subject<string>();

  readonly topicTabs = TOPIC_KEYS;

  readonly rows = computed<Row[]>(() =>
    this.entries().map((raw) => ({
      raw,
      topicKey: TOPIC_KEY[raw.topic] ?? TOPIC_KEY.OTHER,
      keywordText: raw.keywords.join(', '),
    })),
  );
  readonly countEnabled = computed(() => this.entries().filter((one) => one.enabled).length);
  readonly countStarter = computed(() => this.entries().filter((one) => one.starter).length);

  ngOnInit(): void {
    this.load();
    this.typed
      .pipe(debounceTime(TYPE_DELAY_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  load(): void {
    this.status.set('LOADING');
    this.service
      .list(this.topic(), this.keyword())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.entries.set(rows);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  chooseTopic(topic: KnowledgeTopic | null): void {
    this.topic.set(this.topic() === topic ? null : topic);
    this.load();
  }

  search(event: Event): void {
    this.keyword.set((event.target as HTMLInputElement).value);
    this.typed.next(this.keyword());
  }

  add(): void {
    this.openSheet(null);
  }

  edit(row: Row): void {
    this.openSheet(row.raw);
  }

  toggle(row: Row): void {
    this.write(this.service.update(row.raw.code, { enabled: !row.raw.enabled }));
  }

  hide(row: Row): void {
    this.write(this.service.hide(row.raw.code));
  }

  private openSheet(entry: KnowledgeEntry | null): void {
    this.dialog
      .open<KnowledgeFormDialog, KnowledgeFormInput, KnowledgeInput>(KnowledgeFormDialog, {
        ...SHEET,
        data: { entry, codes: this.entries().map((one) => one.code) },
      })
      .afterClosed()
      .pipe(
        filter((result): result is KnowledgeInput => Boolean(result)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) =>
        this.write(entry ? this.service.update(entry.code, result) : this.service.create(result)),
      );
  }

  private write(job: ReturnType<AssistantKnowledgeService['hide']>): void {
    this.sending.set(true);
    this.problem.set(null);
    job
      .pipe(
        switchMap(() => of(true)),
        catchError((trouble: { status?: number }) => {
          this.problem.set(trouble.status === 409 ? 'KNOWLEDGE.CODE_TAKEN' : 'COMMON.GENERIC_ERROR');
          return of(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.sending.set(false);
        this.load();
      });
  }
}
