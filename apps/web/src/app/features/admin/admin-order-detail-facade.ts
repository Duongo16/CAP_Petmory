import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, concatMap } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { AdminOrderDetail, OrderStatus } from '../../core/models/api.model';
import {
  KEY_ACTION,
  KEY_ACTION_OTHER,
  KEY_STATUS_ORDER,
  GROUP_COLOR_STATUS,
} from '../../shared/order-status';

export type ScreenState = 'LOADING' | 'ERROR' | 'READY';

export interface TransitionButton {
  code: OrderStatus;
  key: string;
  groupColor: string;
}

/** Mot lan nguoi truc tich hoac bo tich mot muc tren phieu. */
interface QualityWish {
  at: number;
  done: boolean;
}

export interface HistoryRow {
  id: string;
  keyAction: string;
  actorName: string;
  reason: string;
  at: string;
  keyBefore: string;
  keyAfter: string;
}

/** How far through the workshop an order is, counted from one. */
const STAGE_OF_STATUS: Record<OrderStatus, number> = {
  AWAITING_PAYMENT: 1,
  PAID: 2,
  IN_PRODUCTION: 3,
  SHIPPING: 4,
  COMPLETED: 4,
  CANCELLED: 0,
};

/** The four stages a dispatcher reads, written out so no key is ever built up. */
export const DESK_STAGE_KEYS: string[] = [
  'ADMIN.ORDER.STAGE_PLACED',
  'ADMIN.ORDER.STAGE_PAID',
  'ADMIN.ORDER.STAGE_MAKING',
  'ADMIN.ORDER.STAGE_SENT',
];

/**
 * Reads the status out of an audit entry and maps it to a translation key.
 * An entry that is not about order status returns an empty string.
 */
function statusKeyOf(value: unknown): string {
  const code = (value as { status?: string } | null)?.status;
  if (!code) {
    return '';
  }
  return KEY_STATUS_ORDER[code as OrderStatus] ?? '';
}

@Injectable()
export class AdminOrderDetailFacade {
  private readonly service = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly data = signal<AdminOrderDetail | null>(null);
  private readonly tickWanted = new Subject<QualityWish>();
  private orderCode = '';

  readonly status = signal<ScreenState>('LOADING');
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly reason = signal('');

  readonly order = computed(() => this.data()?.order ?? null);

  /** Don gom toan hang co san, toan hang lam theo yeu cau, hay ca hai. */
  readonly kindKey = computed(() => {
    const rows = this.order()?.rows ?? [];
    const ready = rows.filter((one) => one.kind === 'READY_MADE').length;
    if (ready === 0) {
      return 'ADMIN.ORDER.MADE_TO_ORDER';
    }
    return ready === rows.length ? 'ADMIN.ORDER.READY_MADE' : 'ADMIN.ORDER.MIXED';
  });
  readonly customer = computed(() => this.data()?.customer ?? null);

  /** Which of the four stages the order has reached, zero once cancelled. */
  readonly stage = computed(() => {
    const d = this.order();
    return d ? STAGE_OF_STATUS[d.status] : 0;
  });

  readonly keyStatus = computed(() => {
    const d = this.order();
    return d ? KEY_STATUS_ORDER[d.status] : '';
  });

  readonly groupColor = computed(() => {
    const d = this.order();
    return d ? GROUP_COLOR_STATUS[d.status] : '';
  });

  readonly buttons = computed<TransitionButton[]>(() =>
    (this.data()?.nextSteps ?? []).map((code) => ({
      code,
      key: KEY_STATUS_ORDER[code],
      groupColor: GROUP_COLOR_STATUS[code],
    })),
  );

  readonly history = computed<HistoryRow[]>(() =>
    (this.data()?.history ?? []).map((b) => ({
      id: b._id,
      keyAction: KEY_ACTION[b.action] ?? KEY_ACTION_OTHER,
      actorName: b.actor?.fullName ?? '',
      reason: b.reason,
      at: b.createdAt,
      keyBefore: statusKeyOf(b.before),
      keyAfter: statusKeyOf(b.after),
    })),
  );

  start(orderCode: string): void {
    this.orderCode = orderCode;
    this.listenTick();
    this.reload();
  }

  /**
   * Xep cac lan tich vao mot hang doi va gui lan luot.
   *
   * Nguoi truc thuong tich lien tay bay muc mot luc. Neu moi lan tich deu khoa
   * ca bang cho den khi may chu tra loi thi nhung cai tich sau se roi mat ma
   * khong ai biet, nen o day giu nguyen thu tu va khong bo lan nao.
   */
  private listenTick(): void {
    this.tickWanted
      .pipe(
        concatMap((wish) =>
          this.service.setQualityTick(this.orderCode, wish.at, wish.done).pipe(
            catchError((e: { status?: number }) => {
              this.error.set(this.changeError(e.status));
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((fresh) => this.data.set(fresh));
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .detailOrder(this.orderCode)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (kq) => {
          this.data.set(kq);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /** Cac muc tren phieu kiem tra chat luong cua don dang xem. */
  readonly qualityCheck = computed(() => this.order()?.qualityCheck ?? []);

  /** Con bao nhieu muc chua tich. Bang khong thi moi roi duoc khau kiem dinh. */
  readonly qualityLeft = computed(
    () => this.qualityCheck().filter((one) => !one.done).length,
  );

  setQualityTick(at: number, done: boolean): void {
    this.error.set(null);
    this.tickWanted.next({ at, done });
  }

  transition(next: OrderStatus): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.service
      .changeStatus(this.orderCode, next, this.reason().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (kq) => {
          this.saving.set(false);
          this.reason.set('');
          this.data.set(kq);
        },
        error: (e: { status?: number }) => {
          this.saving.set(false);
          this.error.set(this.stepError(e.status, next));
          // Don da doi o noi khac thi doc lai, de cac nut buoc tiep theo dung voi hien trang.
          if (e.status === 409) {
            this.reload();
          }
        },
      });
  }

  /**
   * Chon loi de hien. Khi may chu tu choi buoc chuyen sang dang giao ma phieu
   * kiem tra van con muc chua tich thi noi thang ly do do, vi cau chung chung
   * se khien nguoi truc tuong la buoc chuyen sai.
   */
  private stepError(status: number | undefined, next: OrderStatus): string {
    if (status === 400 && next === 'SHIPPING' && this.qualityLeft() > 0) {
      return 'ADMIN.QUALITY.BLOCKED';
    }
    return this.changeError(status);
  }

  private changeError(status: number | undefined): string {
    if (status === 403) {
      return 'ADMIN.ERROR_NOT_RAW_PERMISSION';
    }
    if (status === 400) {
      return 'ADMIN.ERROR_STEP_NOT_VALID';
    }
    if (status === 409) {
      return 'ADMIN.ERROR_ORDER_STALE';
    }
    return 'COMMON.GENERIC_ERROR';
  }
}
