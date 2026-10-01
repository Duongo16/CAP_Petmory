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
}

/** One order card with everything the view needs already worked out. */
export interface OrderCard {
  raw: Order;
  rows: CardRow[];
  statusKey: string;
  statusTone: string;
  needsPayment: boolean;
  stage: number;
  headline: string;
  finished: boolean;
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
      return {
        raw,
        rows: raw.rows.map((row) => {
          const size = byCode.get(row.productTypeCode)?.sizes.find((one) => one.code === row.sizeCode);
          return { raw: row, sizeName: size ? size.displayName : row.sizeCode };
        }),
        statusKey: MINE_STATUS_KEY[raw.status],
        statusTone: GROUP_COLOR_STATUS[raw.status],
        needsPayment: NEEDS_PAYMENT.includes(raw.status),
        stage: STAGE_OF_STATUS[raw.status],
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
}
