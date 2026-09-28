import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

export interface HistoryRow {
  id: string;
  keyAction: string;
  actorName: string;
  reason: string;
  at: string;
  keyBefore: string;
  keyAfter: string;
}

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
  private orderCode = '';

  readonly status = signal<ScreenState>('LOADING');
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly reason = signal('');

  readonly order = computed(() => this.data()?.order ?? null);
  readonly customer = computed(() => this.data()?.customer ?? null);

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
    this.reload();
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
          this.error.set(this.changeError(e.status));
        },
      });
  }

  private changeError(status: number | undefined): string {
    if (status === 403) {
      return 'ADMIN.ERROR_NOT_RAW_PERMISSION';
    }
    if (status === 400) {
      return 'ADMIN.ERROR_STEP_NOT_VALID';
    }
    return 'COMMON.GENERIC_ERROR';
  }
}
