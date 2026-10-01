import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { CartService } from '../../core/services/cart.service';
import { OrdersService } from '../../core/services/orders.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CartLine, ProductType } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { Icon } from '../../shared/icon/icon';
import { OrderSteps } from './order-steps/order-steps';

/**
 * The cities offered as suggestions under the province field. Typing something
 * else is still allowed, so the list only saves keystrokes for the common ones.
 */
/** One row of the order summary, with the product picture already resolved. */
interface BillLine {
  raw: CartLine;
  imageUrl: string | null;
}

const PROVINCES: string[] = [
  'Hà Nội',
  'Thành phố Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Huế',
  'Nha Trang',
  'Bình Dương',
  'Đồng Nai',
  'Quảng Ninh',
];

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

@Component({
  selector: 'pm-checkout-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, MoneyPipe, Icon, OrderSteps],
  templateUrl: './checkout-page.html',
  styleUrl: './checkout-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cartService = inject(CartService);
  private readonly orders = inject(OrdersService);
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly pendingSend = signal(false);
  readonly error = signal<string | null>(null);
  readonly cart = this.cartService.cart;
  readonly provinces = PROVINCES;

  private readonly products = signal<ProductType[]>([]);

  readonly lines = computed<BillLine[]>(() => {
    const byCode = new Map(this.products().map((p) => [p.code, p]));
    return this.cart().items.map((raw) => ({
      raw,
      imageUrl: byCode.get(raw.productTypeCode)?.imageUrl ?? null,
    }));
  });

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    phone: ['', [Validators.required, Validators.pattern(/^0\d{9}$/)]],
    address: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(250)]],
    province: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    note: ['', [Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    forkJoin({
      cart: this.cartService.reload(),
      products: this.catalog.product$.pipe(catchError(() => of<ProductType[]>([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (both) => {
          this.products.set(both.products);
          this.status.set('READY');
        },
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
