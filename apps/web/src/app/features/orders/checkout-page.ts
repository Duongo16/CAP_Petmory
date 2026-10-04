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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of, finalize } from 'rxjs';
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
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly pendingSend = signal(false);
  readonly error = signal<string | null>(null);
  readonly cart = this.cartService.cart;
  readonly provinces = PROVINCES;

  private readonly products = signal<ProductType[]>([]);

  readonly selectedItemIds = computed<string[]>(() => {
    const raw = this.route.snapshot.queryParamMap.get('items');
    if (!raw) return [];
    return raw.split(',').filter(Boolean);
  });

  readonly filteredItems = computed<CartLine[]>(() => {
    const all = this.cart().items;
    const selected = this.selectedItemIds();
    if (selected.length === 0) {
      return all;
    }
    const set = new Set(selected);
    const filtered = all.filter((i) => set.has(i.id));
    return filtered.length > 0 ? filtered : all;
  });

  readonly lines = computed<BillLine[]>(() => {
    const byCode = new Map(this.products().map((p) => [p.code, p]));
    return this.filteredItems().map((raw) => ({
      raw,
      imageUrl: byCode.get(raw.productTypeCode)?.imageUrl ?? null,
    }));
  });

  readonly orderTotal = computed(() => {
    let sum = 0n;
    for (const item of this.filteredItems()) {
      sum += BigInt(item.unitPrice) * BigInt(item.quantity);
    }
    return sum.toString();
  });

  readonly orderCount = computed(() => {
    return this.filteredItems().reduce((acc, item) => acc + item.quantity, 0);
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
    if (this.form.invalid || this.pendingSend() || this.filteredItems().length === 0) {
      this.form.markAllAsTouched();
      return;
    }
    this.pendingSend.set(true);
    this.error.set(null);

    const selected = this.selectedItemIds();
    const itemIds = selected.length > 0 ? selected : undefined;

    this.orders
      .create({ ...this.form.getRawValue(), itemIds })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.pendingSend.set(false);
          /*
           * Doc lai gio truoc roi moi chuyen trang. Chuyen trang ngay thi man
           * hinh nay bi huy, keo theo huy luon yeu cau doc gio, va thanh dieu
           * huong van hien so mon cu du gio da trong.
           */
          this.cartService
            .reload()
            .pipe(
              finalize(() => void this.router.navigate(['/payments', order.orderCode])),
              takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({ error: () => undefined });
        },
        error: (trouble: { status?: number }) => {
          this.pendingSend.set(false);
          if (trouble.status === 409) {
            // Gio duoc may chu tra lai nguyen ven; doc lai de thay dung so luong va gia.
            this.error.set('CHECKOUT.STOCK_CHANGED');
            this.cartService.reload().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
            return;
          }
          this.error.set('COMMON.GENERIC_ERROR');
        },
      });
  }
}
