import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Order, PaymentQr } from '../../core/models/api.model';
import { OrdersService } from '../../core/services/orders.service';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/**
 * Doc huong dan chuyen khoan bang QR tinh va ghi nhan khach da chuyen.
 *
 * Trang nay khong doi soat hay tu lam moi trang thai: nhan vien se kiem tra
 * giao dich va xac nhan don tren ban dieu phoi.
 */
@Injectable()
export class PaymentFacade {
  private readonly orders = inject(OrdersService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<ScreenState>('LOADING');
  private readonly qr = signal<PaymentQr | null>(null);
  private readonly order = signal<Order | null>(null);
  private readonly copiedLabel = signal<string | null>(null);
  readonly confirming = signal(false);
  readonly confirmationError = signal<string | null>(null);
  private code = '';

  readonly status = this.state.asReadonly();
  readonly payment = this.qr.asReadonly();
  readonly paidOrder = this.order.asReadonly();
  readonly copied = this.copiedLabel.asReadonly();

  readonly paid = computed(() => {
    const where = this.qr()?.status;
    return where !== undefined && where !== 'AWAITING_PAYMENT' && where !== 'TRANSFER_CONFIRMED' && where !== 'CANCELLED';
  });
  readonly cancelled = computed(() => this.qr()?.status === 'CANCELLED');
  readonly transferConfirmed = computed(() => this.qr()?.status === 'TRANSFER_CONFIRMED');

  start(orderCode: string): void {
    this.code = orderCode;
    this.state.set('LOADING');
    this.confirmationError.set(null);
    this.orders
      .maQr(orderCode)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payment) => {
          this.qr.set(payment);
          this.state.set('READY');
          if (this.paid()) {
            this.readOrder();
          }
        },
        error: () => this.state.set('ERROR'),
      });
  }

  confirmTransfer(): void {
    if (this.confirming() || this.qr()?.status !== 'AWAITING_PAYMENT') return;
    this.confirming.set(true);
    this.confirmationError.set(null);
    this.orders.confirmTransfer(this.code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.confirming.set(false);
          this.qr.update((qr) => qr ? { ...qr, status: order.status } : qr);
        },
        error: (error: { status?: number }) => {
          this.confirming.set(false);
          this.confirmationError.set(error.status === 400 || error.status === 409
            ? 'PAYMENT.CONFIRM_STALE' : 'PAYMENT.CONFIRM_FAILED');
        },
      });
  }

  /** Remembers which value was copied so the button can say so for a moment. */
  markCopied(label: string | null): void {
    this.copiedLabel.set(label);
  }

  private readOrder(): void {
    this.orders
      .detail(this.code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (order) => this.order.set(order), error: () => undefined });
  }
}
