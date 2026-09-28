import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { CartService } from '../../core/services/cart.service';
import { OrdersService } from '../../core/services/orders.service';
import { MoneyPipe } from '../../shared/money.pipe';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

@Component({
  selector: 'pm-checkout-page',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, MoneyPipe],
  templateUrl: './checkout-page.html',
  styleUrl: './checkout-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cartService = inject(CartService);
  private readonly orders = inject(OrdersService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly pendingSend = signal(false);
  readonly error = signal<string | null>(null);
  readonly cart = this.cartService.cart;

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    phone: ['', [Validators.required, Validators.pattern(/^0\d{9}$/)]],
    address: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(250)]],
    province: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    note: ['', [Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    this.cartService
      .reload()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.status.set('READY'),
        error: () => this.status.set('ERROR'),
      });
  }

  send(): void {
    if (this.form.invalid || this.pendingSend() || this.cart().items.length === 0) {
      this.form.markAllAsTouched();
      return;
    }
    this.pendingSend.set(true);
    this.error.set(null);

    this.orders
      .create(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.pendingSend.set(false);
          // The server emptied the cart when the order was created, so refresh it here.
          this.cartService.reset();
          void this.router.navigate(['/payments', order.orderCode]);
        },
        error: () => {
          this.pendingSend.set(false);
          this.error.set('COMMON.GENERIC_ERROR');
        },
      });
  }
}
