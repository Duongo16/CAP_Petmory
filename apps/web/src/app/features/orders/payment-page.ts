import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { interval, switchMap } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { OrdersService } from '../../core/services/orders.service';
import { PaymentQr } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

/** How often to ask the server whether the money has arrived. */
const POLL_INTERVAL_MS = 5000;

@Component({
  selector: 'pm-payment-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe, MoneyPipe],
  templateUrl: './payment-page.html',
  styleUrl: './payment-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentPage implements OnInit {
  readonly orderCode = input.required<string>();

  private readonly orders = inject(OrdersService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly maQr = signal<PaymentQr | null>(null);
  readonly copied = signal<string | null>(null);

  readonly isPaid = computed(() => {
    const t = this.maQr()?.status;
    return t !== undefined && t !== 'AWAITING_PAYMENT' && t !== 'PAYMENT_EXPIRED';
  });

  ngOnInit(): void {
    this.load();
    this.byChange();
  }

  /** Copies the account number or message so the customer can paste it into their banking app. */
  async copy(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(label);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {
      return;
    }
  }

  private load(): void {
    this.orders
      .maQr(this.orderCode())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (qr) => {
          this.maQr.set(qr);
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /**
   * Polls the server until the order changes status.
   * The customer never has to refresh the page.
   */
  private byChange(): void {
    interval(POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.orders.maQr(this.orderCode())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (qr) => this.maQr.set(qr),
        error: () => undefined,
      });
  }
}
