import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminService } from '../../core/services/admin.service';
import { Order, OrderStatus } from '../../core/models/api.model';
import {
  KEY_STATUS_ORDER,
  GROUP_COLOR_STATUS,
  SORT_ORDER_STATUS,
} from '../../shared/order-status';

const TILE_ICON: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'tag',
  PAID: 'check',
  IN_PRODUCTION: 'candle',
  SHIPPING: 'truck',
  COMPLETED: 'star',
  CANCELLED: 'close',
};

export type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/**
 * The short note under each counter, saying what that pile of orders is
 * waiting on. Every key is written out rather than built from the status name.
 */
const TILE_NOTE: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'ADMIN.TILE.AWAITING_PAYMENT',
  PAID: 'ADMIN.TILE.PAID',
  IN_PRODUCTION: 'ADMIN.TILE.IN_PRODUCTION',
  SHIPPING: 'ADMIN.TILE.SHIPPING',
  COMPLETED: 'ADMIN.TILE.COMPLETED',
  CANCELLED: 'ADMIN.TILE.CANCELLED',
};

/** One counter tile on the dispatch board. */
export interface CounterTile {
  code: OrderStatus;
  key: string;
  noteKey: string;
  groupColor: string;
  icon: string;
  count: number;
  selected: boolean;
}

/** One order row with its display values precomputed. */
export interface OrderRow {
  raw: Order;
  keyStatus: string;
  groupColor: string;
  /** What was ordered, named for the board rather than listed in full. */
  what: string;
  more: number;
}

@Injectable()
export class AdminOrdersFacade {
  private readonly service = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stats = signal<Record<string, number>>({});
  private readonly result = signal<Order[]>([]);

  readonly status = signal<ScreenState>('LOADING');
  readonly filterStatus = signal<OrderStatus | ''>('');
  readonly keyword = signal('');
  readonly page = signal(1);
  readonly pageCount = signal(1);
  readonly total = signal(0);

  readonly tiles = computed<CounterTile[]>(() => {
    const count = this.stats();
    const selected = this.filterStatus();
    return SORT_ORDER_STATUS.map((code) => ({
      code,
      key: KEY_STATUS_ORDER[code],
      noteKey: TILE_NOTE[code],
      groupColor: GROUP_COLOR_STATUS[code],
      icon: TILE_ICON[code],
      count: count[code] ?? 0,
      selected: selected === code,
    }));
  });

  readonly rows = computed<OrderRow[]>(() =>
    this.result().map((raw) => ({
      raw,
      keyStatus: KEY_STATUS_ORDER[raw.status],
      groupColor: GROUP_COLOR_STATUS[raw.status],
      what: raw.rows[0]?.displayName ?? '',
      more: Math.max(0, raw.rows.length - 1),
    })),
  );

  readonly remainingPrevPage = computed(() => this.page() > 1);
  readonly remainingNextPage = computed(() => this.page() < this.pageCount());

  /** Page numbers to show in the pager — null means an ellipsis gap. */
  readonly pageRange = computed<(number | null)[]>(() => {
    const total = this.pageCount();
    const cur = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | null)[] = [1];
    if (cur > 3) pages.push(null);
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p);
    if (cur < total - 2) pages.push(null);
    pages.push(total);
    return pages;
  });

  reload(): void {
    this.status.set('LOADING');
    this.service
      .statsOrder()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (tk) => this.stats.set(tk), error: () => undefined });

    this.service
      .listOrder({
        status: this.filterStatus(),
        keyword: this.keyword(),
        page: this.page(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (kq) => {
          this.result.set(kq.rows);
          this.total.set(kq.total);
          this.pageCount.set(kq.pageCount);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /** Clicking the selected tile clears the filter, which is quicker than hunting for a clear button. */
  selectStatus(code: OrderStatus): void {
    this.filterStatus.update((old) => (old === code ? '' : code));
    this.page.set(1);
    this.reload();
  }

  search(text: string): void {
    this.keyword.set(text.trim());
    this.page.set(1);
    this.reload();
  }

  removeFilter(): void {
    this.filterStatus.set('');
    this.keyword.set('');
    this.page.set(1);
    this.reload();
  }

  changePage(step: number): void {
    const next = this.page() + step;
    if (next < 1 || next > this.pageCount()) return;
    this.page.set(next);
    this.reload();
  }

  goToPage(num: number): void {
    if (num === this.page()) return;
    this.page.set(num);
    this.reload();
  }
}
