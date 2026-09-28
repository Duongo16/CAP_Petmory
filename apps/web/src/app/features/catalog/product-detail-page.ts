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
import { DatePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogService } from '../../core/services/catalog.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import {
  DisplayBase,
  PendingReview,
  ProductReview,
  ProductSize,
  ProductType,
} from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { Rating } from '../../shared/rating/rating';
import { Icon } from '../../shared/icon/icon';

type ScreenState = 'LOADING' | 'ERROR' | 'READY';

@Component({
  selector: 'pm-product-detail-page',
  standalone: true,
  imports: [FormsModule, DatePipe, TranslatePipe, MoneyPipe, Rating, Icon],
  templateUrl: './product-detail-page.html',
  styleUrl: './product-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailPage implements OnInit {
  /** Product type code from the URL, via the router's parameter binding. */
  readonly code = input.required<string>();

  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly location = inject(Location);
  private readonly notification = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.user;
  readonly status = signal<ScreenState>('LOADING');
  readonly product = signal<ProductType | null>(null);
  readonly sizeSelected = signal<ProductSize | null>(null);
  readonly quantity = signal(1);
  readonly pendingAdd = signal(false);
  readonly favourite = signal(false);
  readonly descriptionOpen = signal(false);

  readonly bases = signal<DisplayBase[]>([]);
  readonly baseSelected = signal<DisplayBase | null>(null);

  readonly reviews = signal<ProductReview[]>([]);
  readonly reviewable = signal<PendingReview | null>(null);
  readonly draftRating = signal(0);
  readonly draftComment = signal('');
  readonly reviewSent = signal(false);

  readonly sizes = computed(() => this.product()?.sizes.filter((s) => s.enabled) ?? []);

  /**
   * The total is for display only. The server recalculates when the item is added,
   * so the number here never decides the order's value.
   */
  readonly total = computed(() => {
    const size = this.sizeSelected();
    if (!size) {
      return null;
    }
    const unitPrice = BigInt(size.price.$numberDecimal.split('.')[0]);
    const delta = BigInt(this.baseSelected()?.priceDelta.$numberDecimal.split('.')[0] ?? '0');
    return ((unitPrice + delta) * BigInt(this.quantity())).toString();
  });

  /** Precomputes each base with its price difference, so the view calls no functions. */
  readonly baseOptions = computed(() =>
    this.bases().map((base) => ({
      raw: base,
      delta: base.priceDelta.$numberDecimal.split('.')[0],
      free: BigInt(base.priceDelta.$numberDecimal.split('.')[0]) === 0n,
      selected: this.baseSelected()?.code === base.code,
    })),
  );

  readonly canReview = computed(() => this.reviewable() !== null && !this.reviewSent());

  ngOnInit(): void {
    this.loadProduct();

    this.catalog.displayBase$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => {
        this.bases.set(list);
        this.baseSelected.set(list[0] ?? null);
      },
      error: () => undefined,
    });

    this.catalog
      .reviewsOf(this.code())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.reviews.set(list), error: () => undefined });

    if (this.user()) {
      this.catalog
        .favouriteCodes()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (codes) => this.favourite.set(codes.includes(this.code().toUpperCase())),
          error: () => undefined,
        });

      this.catalog
        .pendingReviews()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (list) =>
            this.reviewable.set(
              list.find((r) => r.productTypeCode === this.code().toUpperCase()) ?? null,
            ),
          error: () => undefined,
        });
    }
  }

  back(): void {
    this.location.back();
  }

  selectSize(size: ProductSize): void {
    this.sizeSelected.set(size);
  }

  selectBase(base: DisplayBase): void {
    this.baseSelected.set(base);
  }

  toggleDescription(): void {
    this.descriptionOpen.update((open) => !open);
  }

  changeQuantity(step: number): void {
    this.quantity.update((s) => Math.min(99, Math.max(1, s + step)));
  }

  toggleFavourite(): void {
    this.catalog
      .toggleFavourite(this.code())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.favourite.set(r.favourite), error: () => undefined });
  }

  addToCart(): void {
    const product = this.product();
    const size = this.sizeSelected();
    if (!product || !size || this.pendingAdd()) {
      return;
    }
    this.pendingAdd.set(true);
    this.cart
      .add({
        productTypeCode: product.code,
        sizeCode: size.code,
        quantity: this.quantity(),
        displayBaseCode: this.baseSelected()?.code,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pendingAdd.set(false);
          this.openNotification('PRODUCT.ADDED');
        },
        error: () => {
          this.pendingAdd.set(false);
          this.openNotification('COMMON.GENERIC_ERROR');
        },
      });
  }

  sendReview(): void {
    const pending = this.reviewable();
    if (!pending || this.draftRating() < 1) {
      return;
    }
    this.catalog
      .writeReview({
        productTypeCode: pending.productTypeCode,
        orderCode: pending.orderCode,
        rating: this.draftRating(),
        comment: this.draftComment().trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.reviewSent.set(true);
          this.loadProduct();
          this.catalog
            .reviewsOf(this.code())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: (list) => this.reviews.set(list), error: () => undefined });
        },
        error: () => this.openNotification('COMMON.GENERIC_ERROR'),
      });
  }

  private openNotification(key: string): void {
    this.notification.open(key, undefined, { duration: 2600 });
  }

  private loadProduct(): void {
    this.catalog
      .productDetail(this.code())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          this.product.set(product);
          if (!this.sizeSelected()) {
            this.sizeSelected.set(product.sizes.find((s) => s.enabled) ?? null);
          }
          this.status.set('READY');
        },
        error: () => this.status.set('ERROR'),
      });
  }
}
