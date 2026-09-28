import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { OrdersService } from '../../core/services/orders.service';
import { Order, OrderStatus } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { KEY_STATUS_ORDER } from '../../shared/order-status';

type ScreenState = 'LOADING' | 'ERROR' | 'EMPTY' | 'HAS_DATA';

/** Statuses that still need action from the customer. */
const NEEDS_PAYMENT: OrderStatus[] = ['AWAITING_PAYMENT', 'PAYMENT_EXPIRED'];

@Component({
  selector: 'pm-orders-page',
  standalone: true,
  imports: [RouterLink, DatePipe, TranslatePipe, MoneyPipe],
  templateUrl: './orders-page.html',
  styleUrl: './orders-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage implements OnInit {
  private readonly service = inject(OrdersService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly list = signal<Order[]>([]);

  /** Precomputes translation keys and button visibility so the view calls no functions. */
  readonly rows = computed(() =>
    this.list().map((raw) => ({
      raw,
      keyStatus: KEY_STATUS_ORDER[raw.status],
      needsPayment: NEEDS_PAYMENT.includes(raw.status),
    })),
  );

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ds) => {
          this.list.set(ds);
          this.status.set(ds.length === 0 ? 'EMPTY' : 'HAS_DATA');
        },
        error: () => this.status.set('ERROR'),
      });
  }

}
