import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, switchMap, takeWhile } from 'rxjs';
import { OrdersService } from '../../core/services/orders.service';
import { Order, PaymentQr } from '../../core/models/api.model';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/** How often to ask the server whether the money has arrived. */
const POLL_INTERVAL_MS = 5000;

/** How often the countdown beside the code is redrawn. */
const TICK_MS = 1000;

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const SECOND_MS = 1000;

/** Two digits, so the reading never jumps about as the numbers change width. */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Turns a number of milliseconds into a clock reading. The window a customer
 * gets is measured in hours, so the hours are shown whenever there are any
 * rather than being rolled into a minute count of four figures.
 */
function asClock(left: number): string {
  const hours = Math.floor(left / HOUR_MS);
  const minutes = Math.floor((left % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((left % MINUTE_MS) / SECOND_MS);
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/**
 * Holds the transfer details, the countdown and the waiting for the money.
 * The screen only reads signals, so nothing about the polling leaks into it.
 */
@Injectable()
export class PaymentFacade {
  private readonly orders = inject(OrdersService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<ScreenState>('LOADING');
  private readonly qr = signal<PaymentQr | null>(null);
  private readonly order = signal<Order | null>(null);
  private readonly now = signal(Date.now());
  private readonly copiedLabel = signal<string | null>(null);
  private readonly checking = signal(false);
  private code = '';

  readonly status = this.state.asReadonly();
  readonly payment = this.qr.asReadonly();
  readonly paidOrder = this.order.asReadonly();
  readonly copied = this.copiedLabel.asReadonly();
  readonly checkingNow = this.checking.asReadonly();

  /** Don con dang cho tien, hoac chua doc duoc lan nao. */
  private readonly waiting = computed(() => {
    const where = this.qr()?.status;
    return where === undefined || where === 'AWAITING_PAYMENT';
  });

  /** Tien da ve: don da sang mot buoc sau thanh toan. Don da huy khong tinh. */
  readonly paid = computed(() => {
    const where = this.qr()?.status;
    return where !== undefined && where !== 'AWAITING_PAYMENT' && where !== 'CANCELLED';
  });

  readonly cancelled = computed(() => this.qr()?.status === 'CANCELLED');

  /** Milliseconds left before the transfer code stops being accepted. */
  private readonly leftMs = computed(() => {
    const until = this.qr()?.paymentDeadline;
    if (!until) {
      return 0;
    }
    return Math.max(0, new Date(until).getTime() - this.now());
  });

  readonly countdown = computed(() => asClock(this.leftMs()));
  readonly expired = computed(() => {
    const qr = this.qr();
    return qr !== null && this.waiting() && (qr.expired || this.leftMs() === 0);
  });

  start(orderCode: string): void {
    this.code = orderCode;
    this.state.set('LOADING');
    this.readOnce();
    this.watchMoney();
    this.watchClock();
  }

  /** Asks the server right away rather than waiting for the next poll. */
  checkNow(): void {
    this.checking.set(true);
    this.orders
      .maQr(this.code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fresh) => {
          this.checking.set(false);
          this.take(fresh);
        },
        error: () => this.checking.set(false),
      });
  }

  /** Remembers which value was copied so the button can say so for a moment. */
  markCopied(label: string | null): void {
    this.copiedLabel.set(label);
  }

  private readOnce(): void {
    this.orders
      .maQr(this.code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fresh) => {
          this.take(fresh);
          this.state.set('READY');
        },
        error: () => this.state.set('ERROR'),
      });
  }

  private watchMoney(): void {
    // Thoi hoi khi don da thanh toan hoac da huy: khong con gi de cho.
    interval(POLL_INTERVAL_MS)
      .pipe(
        takeWhile(() => this.waiting()),
        switchMap(() => this.orders.maQr(this.code)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (fresh) => this.take(fresh), error: () => undefined });
  }

  private watchClock(): void {
    interval(TICK_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));
  }

  /** Keeps the newest answer, and fetches the order once the money is in. */
  private take(fresh: PaymentQr): void {
    const wasPaid = this.paid();
    this.qr.set(fresh);
    if (this.paid() && !wasPaid) {
      this.readOrder();
    }
  }

  private readOrder(): void {
    this.orders
      .detail(this.code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (one) => this.order.set(one), error: () => undefined });
  }
}
