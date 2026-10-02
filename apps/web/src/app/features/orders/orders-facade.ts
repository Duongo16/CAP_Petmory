import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { OrdersService } from '../../core/services/orders.service';
import { CatalogService } from '../../core/services/catalog.service';
import { Order, OrderLine, OrderStatus, ProductType } from '../../core/models/api.model';
import { GROUP_COLOR_STATUS } from '../../shared/order-status';

type ScreenState = 'LOADING' | 'ERROR' | 'EMPTY' | 'DONE';

/** The groups the filter pills offer, in the order the design shows them. */
export type OrderGroup = 'ALL' | 'AWAITING' | 'MAKING' | 'SHIPPING' | 'FINISHED';

/** Which statuses each pill gathers. The first pill gathers everything. */
const GROUP_HOLDS: Record<Exclude<OrderGroup, 'ALL'>, OrderStatus[]> = {
  AWAITING: ['AWAITING_PAYMENT'],
  MAKING: ['PAID', 'IN_PRODUCTION'],
  SHIPPING: ['SHIPPING'],
  FINISHED: ['COMPLETED'],
};

const GROUP_KEY: Record<OrderGroup, string> = {
  ALL: 'ORDER.GROUP.ALL',
  AWAITING: 'ORDER.GROUP.AWAITING',
  MAKING: 'ORDER.GROUP.MAKING',
  SHIPPING: 'ORDER.GROUP.SHIPPING',
  FINISHED: 'ORDER.GROUP.FINISHED',
};

export const GROUP_ORDER: OrderGroup[] = ['ALL', 'AWAITING', 'MAKING', 'SHIPPING', 'FINISHED'];

/**
 * What a customer reads on their own order card. The dispatch board keeps the
 * plainer wording of the shared lookup, so this screen carries its own, with
 * every key written out rather than built up.
 */
const MINE_STATUS_KEY: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'ORDER.MINE_STATUS.AWAITING_PAYMENT',
  PAID: 'ORDER.MINE_STATUS.PAID',
  IN_PRODUCTION: 'ORDER.MINE_STATUS.IN_PRODUCTION',
  SHIPPING: 'ORDER.MINE_STATUS.SHIPPING',
  COMPLETED: 'ORDER.MINE_STATUS.COMPLETED',
  CANCELLED: 'ORDER.MINE_STATUS.CANCELLED',
};

/** Statuses that still wait on the customer to pay. */
const NEEDS_PAYMENT: OrderStatus[] = ['AWAITING_PAYMENT'];

/** How far along the workshop is, counted from one, or zero when cancelled. */
const STAGE_OF_STATUS: Record<OrderStatus, number> = {
  AWAITING_PAYMENT: 1,
  PAID: 2,
  IN_PRODUCTION: 3,
  SHIPPING: 4,
  COMPLETED: 4,
  CANCELLED: 0,
};

/** The four stages of the workshop, written out so no key is ever built up. */
export const STAGE_KEYS: string[] = [
  'ORDER.STAGE.PLACED',
  'ORDER.STAGE.PAID',
  'ORDER.STAGE.CRAFTING',
  'ORDER.STAGE.PACKING',
];

/** Hang co san khong qua xuong, nen chi co ba chang: dat, tra tien, dong goi va giao. */
const STAGE_KEYS_READY: string[] = [
  'ORDER.STAGE.PLACED',
  'ORDER.STAGE.PAID',
  'ORDER.STAGE.PACKING',
];

const STAGE_OF_STATUS_READY: Record<OrderStatus, number> = {
  AWAITING_PAYMENT: 1,
  PAID: 2,
  IN_PRODUCTION: 2,
  SHIPPING: 3,
  COMPLETED: 3,
  CANCELLED: 0,
};

/** One filter pill, carrying how many orders sit behind it. */
export interface GroupChip {
  group: OrderGroup;
  key: string;
  count: number;
}

/** One line of an order, with the size named rather than coded. */
export interface CardRow {
  raw: OrderLine;
  sizeName: string;
  readyMade: boolean;
}

/** One order card with everything the view needs already worked out. */
export interface OrderCard {
  raw: Order;
  rows: CardRow[];
  statusKey: string;
  statusTone: string;
  needsPayment: boolean;
  stage: number;
  stageKeys: string[];
  headline: string;
  finished: boolean;
  /** Moi dong deu la hang co san: khong co bao hanh len, khong qua xuong. */
  readyOnly: boolean;
}

function holdsOf(group: OrderGroup): OrderStatus[] | null {
  return group === 'ALL' ? null : GROUP_HOLDS[group];
}

/**
 * Holds the customer's order history and the filter above it.
 * The screen only reads signals and issues commands.
 */
@Injectable()
export class OrdersFacade {
  private readonly service = inject(OrdersService);
  private readonly catalog = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<ScreenState>('LOADING');
  private readonly all = signal<Order[]>([]);
  private readonly group = signal<OrderGroup>('ALL');
  private readonly products = signal<ProductType[]>([]);

  readonly status = this.state.asReadonly();
  readonly chosen = this.group.asReadonly();

  readonly chips = computed<GroupChip[]>(() =>
    GROUP_ORDER.map((group) => {
      const holds = holdsOf(group);
      const list = holds === null ? this.all() : this.all().filter((o) => holds.includes(o.status));
      return { group, key: GROUP_KEY[group], count: list.length };
    }),
  );

  readonly cards = computed<OrderCard[]>(() => {
    const holds = holdsOf(this.group());
    const list = holds === null ? this.all() : this.all().filter((o) => holds.includes(o.status));
    const byCode = new Map(this.products().map((p) => [p.code, p]));
    return list.map((raw) => {
      const first = raw.rows[0];
      const readyOnly = raw.rows.length > 0 && raw.rows.every((row) => row.kind === 'READY_MADE');
      return {
        raw,
        rows: raw.rows.map((row) => {
          if (row.kind === 'READY_MADE') {
            return { raw: row, sizeName: row.displayName, readyMade: true };
          }
          const size = byCode.get(row.productTypeCode)?.sizes.find((one) => one.code === row.sizeCode);
          return { raw: row, sizeName: size ? size.displayName : row.sizeCode, readyMade: false };
        }),
        statusKey: MINE_STATUS_KEY[raw.status],
        statusTone: GROUP_COLOR_STATUS[raw.status],
        needsPayment: NEEDS_PAYMENT.includes(raw.status),
        stage: (readyOnly ? STAGE_OF_STATUS_READY : STAGE_OF_STATUS)[raw.status],
        stageKeys: readyOnly ? STAGE_KEYS_READY : STAGE_KEYS,
        readyOnly,
        headline: first ? first.displayName : raw.orderCode,
        finished: raw.status === 'COMPLETED',
      };
    });
  });

  /** True when the filter hides everything although the customer has orders. */
  readonly emptyGroup = computed(() => this.all().length > 0 && this.cards().length === 0);

  load(): void {
    this.state.set('LOADING');
    forkJoin({
      orders: this.service.list(),
      products: this.catalog.product$.pipe(catchError(() => of<ProductType[]>([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (both) => {
          this.products.set(both.products);
          this.all.set(both.orders);
          this.state.set(both.orders.length === 0 ? 'EMPTY' : 'DONE');
        },
        error: () => this.state.set('ERROR'),
      });
  }

  choose(group: OrderGroup): void {
    this.group.set(group);
  }

  /** Ma don dang cho khach bam lan thu hai de xac nhan huy. */
  readonly asking = signal<string | null>(null);
  readonly cancelling = signal<string | null>(null);
  readonly cancelProblem = signal<string | null>(null);

  /**
   * Huy mot don chua thanh toan, qua hai lan bam.
   *
   * Lan dau chi hoi lai ngay tren nut, lan thu hai moi gui di, de mot cu bam
   * nham khong lam mat don.
   */
  cancel(orderCode: string): void {
    if (this.cancelling()) {
      return;
    }
    if (this.asking() !== orderCode) {
      this.asking.set(orderCode);
      this.cancelProblem.set(null);
      return;
    }
    this.asking.set(null);
    this.cancelling.set(orderCode);
    this.service
      .cancel(orderCode)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (done) => {
          this.cancelling.set(null);
          this.all.update((list) => list.map((one) => (one.orderCode === done.orderCode ? done : one)));
        },
        error: () => {
          this.cancelling.set(null);
          this.cancelProblem.set('ORDER.CANCEL_FAILED');
          this.load();
        },
      });
  }
}
