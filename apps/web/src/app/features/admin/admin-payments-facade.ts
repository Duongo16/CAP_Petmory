import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminService } from '../../core/services/admin.service';
import { ReconcileResult, ReconcileSummary, TransferNotification } from '../../core/models/api.model';
import { KEY_RESULT_RECONCILE } from '../../shared/order-status';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

const KEY_RESULT_OTHER = 'ADMIN.RECONCILE.OTHER';

/** The groups the filter pills offer, in the order the design shows them. */
export type LogGroup = 'ALL' | 'MATCHED' | 'NEEDS_CHECK' | 'NO_REFERENCE' | 'IGNORED';

/** Nhung ket qua moi nhom gom. Nhom can kiem gom moi truong hop lech can nguoi xu ly. */
const GROUP_HOLDS: Record<Exclude<LogGroup, 'ALL'>, ReconcileResult[]> = {
  MATCHED: ['MATCHED'],
  NEEDS_CHECK: ['UNDERPAID', 'OVERPAID', 'LATE'],
  NO_REFERENCE: ['NO_REFERENCE'],
  IGNORED: ['IGNORED'],
};

const GROUP_KEY: Record<LogGroup, string> = {
  ALL: 'ADMIN.LOG.GROUP_ALL',
  MATCHED: 'ADMIN.RECONCILE.MATCHED',
  NEEDS_CHECK: 'ADMIN.LOG.GROUP_NEEDS_CHECK',
  NO_REFERENCE: 'ADMIN.RECONCILE.NO_REFERENCE',
  IGNORED: 'ADMIN.RECONCILE.IGNORED',
};

export const LOG_GROUP_ORDER: LogGroup[] = ['ALL', 'MATCHED', 'NEEDS_CHECK', 'NO_REFERENCE', 'IGNORED'];

/** Tien da ve cho mot don: du hoac du ra. */
const MONEY_IN: ReconcileResult[] = ['MATCHED', 'OVERPAID'];

/** How many notices one page of the log holds. */
const PAGE_SIZE = 25;

/** One filter pill, carrying how many notices sit behind it. */
export interface LogChip {
  group: LogGroup;
  key: string;
  count: number;
}

/** One notice with its display values already worked out. */
export interface LogRow {
  raw: TransferNotification;
  keyResult: string;
  tone: string;
}

/** The colour group each outcome reads in. */
const TONE_OF_RESULT: Record<string, string> = {
  MATCHED: 'good',
  OVERPAID: 'awaiting',
  LATE: 'bad',
  IGNORED: 'in-progress',
  UNDERPAID: 'bad',
  NO_REFERENCE: 'awaiting',
  ALREADY_PROCESSED: 'in-progress',
};

function sumOf(list: TransferNotification[]): bigint {
  return list.reduce((total, one) => total + BigInt(one.amount), 0n);
}

/** True when the notice arrived on the day the reader is looking at it. */
function isToday(when: string): boolean {
  const at = new Date(when);
  const now = new Date();
  return (
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate()
  );
}

/**
 * Holds the reconciliation log, the summary above it, the filter and the page.
 * The screen only reads signals and issues commands.
 */
@Injectable()
export class AdminPaymentsFacade {
  private readonly service = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly log = signal<TransferNotification[]>([]);
  private readonly group = signal<LogGroup>('ALL');
  private readonly page = signal(1);
  private readonly search = signal('');

  readonly status = signal<ScreenState>('LOADING');
  readonly chosen = this.group.asReadonly();
  readonly pageNow = this.page.asReadonly();
  readonly keyword = this.search.asReadonly();

  /** Everything the filter and the search leave in, newest first. */
  private readonly kept = computed<TransferNotification[]>(() => {
    const group = this.group();
    const text = this.search().trim().toLowerCase();
    return this.log().filter((one) => {
      if (group !== 'ALL' && !GROUP_HOLDS[group].includes(one.result)) {
        return false;
      }
      if (!text) {
        return true;
      }
      return (
        one.transactionId.toLowerCase().includes(text) ||
        one.transferMessage.toLowerCase().includes(text) ||
        one.detectedReference.toLowerCase().includes(text) ||
        one.amount.includes(text)
      );
    });
  });

  readonly total = computed(() => this.kept().length);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  readonly rows = computed<LogRow[]>(() => {
    const from = (this.page() - 1) * PAGE_SIZE;
    return this.kept()
      .slice(from, from + PAGE_SIZE)
      .map((raw) => ({
        raw,
        keyResult: KEY_RESULT_RECONCILE[raw.result] ?? KEY_RESULT_OTHER,
        tone: TONE_OF_RESULT[raw.result] ?? 'in-progress',
      }));
  });

  readonly chips = computed<LogChip[]>(() =>
    LOG_GROUP_ORDER.map((group) => ({
      group,
      key: GROUP_KEY[group],
      count:
        group === 'ALL'
          ? this.log().length
          : this.log().filter((one) => GROUP_HOLDS[group].includes(one.result)).length,
    })),
  );

  /** Money that landed today, as an integer string in dong. */
  readonly takenToday = computed(() =>
    sumOf(this.log().filter((one) => MONEY_IN.includes(one.result) && isToday(one.createdAt))).toString(),
  );

  readonly matchedCount = computed(
    () => this.log().filter((one) => one.result === 'MATCHED').length,
  );
  readonly shortCount = computed(
    () => this.log().filter((one) => GROUP_HOLDS.NEEDS_CHECK.includes(one.result)).length,
  );
  readonly looseCount = computed(
    () => this.log().filter((one) => one.result === 'NO_REFERENCE').length,
  );

  /** What share of notices matched an order without anyone stepping in. */
  readonly matchedShare = computed(() => {
    const all = this.log().length;
    return all === 0 ? 0 : Math.round((this.matchedCount() / all) * 100);
  });

  readonly remainingPrevPage = computed(() => this.page() > 1);
  readonly remainingNextPage = computed(() => this.page() < this.pageCount());

  /** Ket qua lan doi soat gan nhat, va loi neu co. */
  readonly reconciling = signal(false);
  readonly lastReconcile = signal<ReconcileSummary | null>(null);
  readonly reconcileError = signal<string | null>(null);

  /** Doi soat voi SePay roi doc lai nhat ky de thay giao dich vua bo sung. */
  reconcile(): void {
    this.reconciling.set(true);
    this.reconcileError.set(null);
    this.service
      .reconcileSepay()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.reconciling.set(false);
          this.lastReconcile.set(summary);
          this.reload();
        },
        error: (trouble: HttpErrorResponse) => {
          this.reconciling.set(false);
          const why = (trouble.error as { message?: string } | null)?.message;
          this.reconcileError.set(typeof why === 'string' ? why : '');
        },
      });
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .logPayment()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.log.set(list);
          this.page.set(1);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  choose(group: LogGroup): void {
    this.group.set(group);
    this.page.set(1);
  }

  setKeyword(text: string): void {
    this.search.set(text);
    this.page.set(1);
  }

  changePage(step: number): void {
    this.page.update((now) => Math.min(this.pageCount(), Math.max(1, now + step)));
  }
}
